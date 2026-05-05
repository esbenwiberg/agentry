import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { Gatherer, GathererContext } from "../types.js";
import { execCmd } from "../exec.js";

interface SecretSuspect {
  path: string;
  ruleId: string;
  ruleDescription: string;
  line: number;
  excerpt: string;
}

interface CommittedKey {
  path: string;
  reason: string;
}

interface AuditResult {
  tool: string;
  ranOk: boolean;
  exitCode: number;
  summary?: string;
  raw?: string;
}

const SECRET_RULES: Array<{
  id: string;
  description: string;
  pattern: RegExp;
}> = [
  {
    id: "aws-access-key",
    description: "AWS access key id",
    pattern: /(?<![A-Z0-9])AKIA[0-9A-Z]{16}(?![A-Z0-9])/,
  },
  {
    id: "aws-secret-key",
    description: "AWS secret-access-key shaped string",
    pattern: /aws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9+/]{40}/i,
  },
  {
    id: "github-pat",
    description: "GitHub fine-grained / classic token",
    pattern: /\b(ghp_|github_pat_)[A-Za-z0-9_]{20,}/,
  },
  {
    id: "anthropic-api-key",
    description: "Anthropic API key",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/,
  },
  {
    id: "openai-api-key",
    description: "OpenAI API key",
    pattern: /\bsk-[A-Za-z0-9]{40,}/,
  },
  {
    id: "slack-token",
    description: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  },
  {
    id: "private-key",
    description: "PEM private key block",
    pattern: /-----BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) ?KEY-----/,
  },
  {
    id: "google-api-key",
    description: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
];

const KEY_FILE_PATTERNS: Array<{ ext: string; reason: string }> = [
  { ext: ".pem", reason: "PEM file in tracked tree" },
  { ext: ".key", reason: "Key file in tracked tree" },
  { ext: ".p12", reason: "PKCS12 file in tracked tree" },
  { ext: ".pfx", reason: "PFX file in tracked tree" },
];

const ENV_FILE_RE = /^\.env(\.[A-Za-z0-9_-]+)?$/;
const ENV_EXAMPLE_RE = /^\.env(\.(example|sample|template))$/i;

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  "vendor",
  ".venv",
  "venv",
  "coverage",
  ".agentry",
  ".next",
  ".cache",
]);

const SCANNABLE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".cs", ".swift",
  ".sh", ".bash", ".zsh",
  ".yml", ".yaml", ".json", ".toml", ".env", ".ini", ".conf", ".cfg",
  ".md", ".txt",
]);

const MAX_FILE_BYTES = 256_000;
const MAX_SUSPECTS = 100;

async function scanForSecrets(
  root: string,
  rel: string,
  suspects: SecretSuspect[],
  committed: CommittedKey[],
): Promise<void> {
  if (suspects.length >= MAX_SUSPECTS) return;
  let entries;
  try {
    entries = readdirSync(resolve(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (suspects.length >= MAX_SUSPECTS) return;
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      if (ent.name.startsWith(".") && ent.name !== ".github") continue;
      await scanForSecrets(
        root,
        rel === "" ? ent.name : `${rel}/${ent.name}`,
        suspects,
        committed,
      );
      continue;
    }
    if (!ent.isFile()) continue;
    const fullRel = rel === "" ? ent.name : `${rel}/${ent.name}`;

    const ext = extname(ent.name).toLowerCase();
    const keyMatch = KEY_FILE_PATTERNS.find((k) => k.ext === ext);
    if (keyMatch) {
      committed.push({ path: fullRel, reason: keyMatch.reason });
      continue;
    }

    if (ENV_FILE_RE.test(ent.name) && !ENV_EXAMPLE_RE.test(ent.name)) {
      committed.push({ path: fullRel, reason: "Possible committed .env file" });
      continue;
    }

    if (!SCANNABLE_EXT.has(ext) && !ENV_FILE_RE.test(ent.name)) continue;

    let size = 0;
    try {
      size = statSync(resolve(root, fullRel)).size;
    } catch {
      continue;
    }
    if (size === 0 || size > MAX_FILE_BYTES) continue;

    let content: string;
    try {
      content = await readFile(resolve(root, fullRel), "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length && suspects.length < MAX_SUSPECTS; i++) {
      const line = lines[i]!;
      for (const rule of SECRET_RULES) {
        if (rule.pattern.test(line)) {
          suspects.push({
            path: fullRel,
            ruleId: rule.id,
            ruleDescription: rule.description,
            line: i + 1,
            excerpt: redact(line.slice(0, 200)),
          });
          break;
        }
      }
    }
  }
}

function redact(text: string): string {
  return text.replace(
    /([A-Za-z0-9+/]{20,})/g,
    (m) => m.slice(0, 4) + "***" + m.slice(-4),
  );
}

async function lockfileAge(cwd: string): Promise<{
  found: Array<{ file: string; ageDays: number; mtime: string }>;
}> {
  const candidates = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "Cargo.lock",
    "Gemfile.lock",
    "poetry.lock",
    "Pipfile.lock",
    "uv.lock",
    "go.sum",
  ];
  const out: Array<{ file: string; ageDays: number; mtime: string }> = [];
  const now = Date.now();
  for (const name of candidates) {
    const p = resolve(cwd, name);
    if (!existsSync(p)) continue;
    try {
      const s = statSync(p);
      const ageMs = now - s.mtimeMs;
      out.push({
        file: name,
        ageDays: Math.round(ageMs / 86_400_000),
        mtime: new Date(s.mtimeMs).toISOString(),
      });
    } catch {
      /* ignore */
    }
  }
  return { found: out };
}

async function runAudit(
  ctx: GathererContext,
): Promise<AuditResult[]> {
  const results: AuditResult[] = [];
  const cwd = ctx.cwd;

  if (
    ctx.toolAvailability.npm &&
    existsSync(resolve(cwd, "package-lock.json"))
  ) {
    const r = await execCmd("npm", ["audit", "--json"], { cwd, timeoutMs: 30_000 });
    let summary: string | undefined;
    try {
      const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
      const meta = parsed.metadata as Record<string, unknown> | undefined;
      const v = meta?.vulnerabilities as Record<string, unknown> | undefined;
      if (v) summary = JSON.stringify(v);
    } catch {
      /* ignore */
    }
    results.push({
      tool: "npm-audit",
      ranOk: r.exitCode === 0 || r.exitCode === 1,
      exitCode: r.exitCode,
      ...(summary ? { summary } : {}),
    });
  }

  if (ctx.toolAvailability.cargo && existsSync(resolve(cwd, "Cargo.lock"))) {
    const r = await execCmd("cargo", ["audit", "--json"], { cwd, timeoutMs: 30_000 });
    results.push({
      tool: "cargo-audit",
      ranOk: r.exitCode === 0,
      exitCode: r.exitCode,
    });
  }

  return results;
}

export const securityGatherer: Gatherer = {
  name: "security",
  async run(ctx: GathererContext): Promise<string[]> {
    const dir = join(ctx.bundleDir, "security");
    await mkdir(dir, { recursive: true });

    const suspects: SecretSuspect[] = [];
    const committed: CommittedKey[] = [];
    await scanForSecrets(ctx.cwd, "", suspects, committed);

    const ages = await lockfileAge(ctx.cwd);
    const audits = await runAudit(ctx);

    await writeFile(
      join(dir, "secrets-suspects.json"),
      JSON.stringify(
        {
          suspects,
          truncated: suspects.length >= MAX_SUSPECTS,
          ruleCount: SECRET_RULES.length,
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(dir, "committed-keys.json"),
      JSON.stringify(committed, null, 2),
    );
    await writeFile(
      join(dir, "lockfile-age.json"),
      JSON.stringify(ages, null, 2),
    );
    await writeFile(
      join(dir, "audit.json"),
      JSON.stringify(audits, null, 2),
    );

    return [
      "security/secrets-suspects.json",
      "security/committed-keys.json",
      "security/lockfile-age.json",
      "security/audit.json",
    ];
  },
};
