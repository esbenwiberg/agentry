import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Gatherer, GathererContext } from "../types.js";
import { execCmd, type ExecResult } from "../exec.js";

interface FitnessRunResult {
  category: string;
  command: string;
  ranOk: boolean;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  outputExcerpt: string;
  skipped?: boolean;
  reason?: string;
}

const FITNESS_TIMEOUT_MS = 180_000;
const EXCERPT_BYTES = 4_000;

function excerpt(r: ExecResult): string {
  const combined = (r.stdout + (r.stderr ? `\n--- stderr ---\n${r.stderr}` : "")).slice(
    0,
    EXCERPT_BYTES,
  );
  return combined;
}

function skipped(category: string, command: string, reason: string): FitnessRunResult {
  return {
    category,
    command,
    ranOk: false,
    exitCode: -1,
    durationMs: 0,
    timedOut: false,
    outputExcerpt: "",
    skipped: true,
    reason,
  };
}

async function readPackageJson(cwd: string): Promise<Record<string, unknown> | null> {
  const path = resolve(cwd, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface ScriptDetect {
  hasBuild: boolean;
  hasTest: boolean;
  hasTypecheck: boolean;
  hasLint: boolean;
  hasFormatCheck: boolean;
}

function detectScripts(pkg: Record<string, unknown> | null): ScriptDetect {
  const scripts = (pkg?.scripts as Record<string, unknown> | undefined) ?? {};
  const has = (k: string): boolean => typeof scripts[k] === "string";
  return {
    hasBuild: has("build"),
    hasTest: has("test"),
    hasTypecheck: has("typecheck") || has("type-check") || has("tsc"),
    hasLint: has("lint"),
    hasFormatCheck: has("format:check") || has("prettier:check") || has("format"),
  };
}

async function runNodeStack(
  ctx: GathererContext,
  detect: ScriptDetect,
): Promise<FitnessRunResult[]> {
  const cwd = ctx.cwd;
  const npm = ctx.toolAvailability.npm === true;
  const out: FitnessRunResult[] = [];
  if (!npm) {
    out.push(skipped("build", "npm run build", "npm not installed"));
    return out;
  }
  const make = (
    category: string,
    when: boolean,
    args: readonly string[],
  ): Promise<FitnessRunResult> => {
    if (!when) {
      return Promise.resolve(
        skipped(category, `npm ${args.join(" ")}`, `script not present in package.json`),
      );
    }
    return execCmd("npm", args, { cwd, timeoutMs: FITNESS_TIMEOUT_MS }).then((r) => ({
      category,
      command: `npm ${args.join(" ")}`,
      ranOk: r.exitCode === 0,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      timedOut: r.timedOut,
      outputExcerpt: excerpt(r),
    }));
  };

  out.push(await make("build", detect.hasBuild, ["run", "--silent", "build"]));
  out.push(await make("test", detect.hasTest, ["test", "--silent"]));
  out.push(
    await make("typecheck", detect.hasTypecheck, ["run", "--silent", "typecheck"]),
  );
  out.push(await make("lint", detect.hasLint, ["run", "--silent", "lint"]));
  out.push(
    await make("format-check", detect.hasFormatCheck, ["run", "--silent", "format:check"]),
  );
  return out;
}

async function runPythonStack(
  ctx: GathererContext,
): Promise<FitnessRunResult[]> {
  const cwd = ctx.cwd;
  const out: FitnessRunResult[] = [];

  const hasPyproject = existsSync(resolve(cwd, "pyproject.toml"));
  const hasRequirements = existsSync(resolve(cwd, "requirements.txt"));
  if (!hasPyproject && !hasRequirements) return out;

  if (ctx.toolAvailability.pytest) {
    const r = await execCmd("pytest", ["-q", "--no-header"], { cwd, timeoutMs: FITNESS_TIMEOUT_MS });
    out.push({
      category: "test",
      command: "pytest -q",
      ranOk: r.exitCode === 0,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      timedOut: r.timedOut,
      outputExcerpt: excerpt(r),
    });
  } else {
    out.push(skipped("test", "pytest", "pytest not installed"));
  }

  if (ctx.toolAvailability.ruff) {
    const r = await execCmd("ruff", ["check", "."], { cwd, timeoutMs: 60_000 });
    out.push({
      category: "lint",
      command: "ruff check",
      ranOk: r.exitCode === 0,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      timedOut: r.timedOut,
      outputExcerpt: excerpt(r),
    });
  } else {
    out.push(skipped("lint", "ruff check", "ruff not installed"));
  }

  if (ctx.toolAvailability.mypy) {
    const r = await execCmd("mypy", ["."], { cwd, timeoutMs: 90_000 });
    out.push({
      category: "typecheck",
      command: "mypy",
      ranOk: r.exitCode === 0,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      timedOut: r.timedOut,
      outputExcerpt: excerpt(r),
    });
  }

  return out;
}

async function runGoStack(ctx: GathererContext): Promise<FitnessRunResult[]> {
  const cwd = ctx.cwd;
  if (!existsSync(resolve(cwd, "go.mod"))) return [];
  if (!ctx.toolAvailability.go) {
    return [skipped("build", "go build", "go not installed")];
  }
  const out: FitnessRunResult[] = [];
  for (const [category, args, command] of [
    ["build", ["build", "./..."], "go build ./..."],
    ["test", ["test", "./..."], "go test ./..."],
    ["typecheck", ["vet", "./..."], "go vet ./..."],
  ] as const) {
    const r = await execCmd("go", args, { cwd, timeoutMs: FITNESS_TIMEOUT_MS });
    out.push({
      category,
      command,
      ranOk: r.exitCode === 0,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      timedOut: r.timedOut,
      outputExcerpt: excerpt(r),
    });
  }
  return out;
}

async function runRustStack(ctx: GathererContext): Promise<FitnessRunResult[]> {
  const cwd = ctx.cwd;
  if (!existsSync(resolve(cwd, "Cargo.toml"))) return [];
  if (!ctx.toolAvailability.cargo) {
    return [skipped("build", "cargo build", "cargo not installed")];
  }
  const out: FitnessRunResult[] = [];
  for (const [category, args, command] of [
    ["build", ["build", "--quiet"], "cargo build"],
    ["test", ["test", "--quiet"], "cargo test"],
    ["typecheck", ["check", "--quiet"], "cargo check"],
  ] as const) {
    const r = await execCmd("cargo", args, { cwd, timeoutMs: FITNESS_TIMEOUT_MS });
    out.push({
      category,
      command,
      ranOk: r.exitCode === 0,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      timedOut: r.timedOut,
      outputExcerpt: excerpt(r),
    });
  }
  return out;
}

export const fitnessGatherer: Gatherer = {
  name: "fitness",
  shouldRun(ctx: GathererContext): boolean {
    return ctx.options.fitness === true;
  },
  async run(ctx: GathererContext): Promise<string[]> {
    const dir = join(ctx.bundleDir, "fitness");
    await mkdir(dir, { recursive: true });

    const pkg = await readPackageJson(ctx.cwd);
    const scripts = detectScripts(pkg);

    const results: FitnessRunResult[] = [];
    if (pkg) results.push(...(await runNodeStack(ctx, scripts)));
    results.push(...(await runPythonStack(ctx)));
    results.push(...(await runGoStack(ctx)));
    results.push(...(await runRustStack(ctx)));

    if (results.length === 0) {
      results.push(
        skipped("any", "(none detected)", "no recognised stack manifests"),
      );
    }

    await writeFile(
      join(dir, "results.json"),
      JSON.stringify(
        {
          warning:
            "Fitness tests execute project code. Re-run scan with --no-fitness if running on untrusted repos.",
          results,
        },
        null,
        2,
      ),
    );
    return ["fitness/results.json"];
  },
};
