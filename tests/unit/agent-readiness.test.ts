import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "../helpers/cli.js";
import { makeRepoFixture } from "../helpers/fixtures.js";

interface AgentReadinessReport {
  configs: Array<{ tool: string; paths: string[] }>;
  docs: Array<{
    kind: string;
    path: string;
    bytes: number;
    lastTouchedDaysAgo?: number;
  }>;
  nestedContextFiles: Array<{
    kind: "claude-md" | "agents-md";
    path: string;
    bytes: number;
    depth: number;
  }>;
  monorepo: { isMonorepo: boolean; markers: string[] };
  localConfigIgnored: {
    hasGitignore: boolean;
    ignoresClaudeLocalMd: boolean;
    ignoresClaudeSettingsLocal: boolean;
  };
  fitnessReachability: {
    declaredCommands: Record<string, string>;
    contextDocsMentioning: string[];
    reachable: boolean;
  };
  staleSignals: Array<{ kind: string; path: string; reason: string }>;
}

async function readReport(cwd: string): Promise<AgentReadinessReport> {
  const root = join(cwd, ".agentry", "scan");
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(root);
  const bundle = join(root, entries[0]!);
  const txt = await readFile(
    join(bundle, "agent-readiness", "report.json"),
    "utf8",
  );
  return JSON.parse(txt) as AgentReadinessReport;
}

describe("agent-readiness — nested context files", () => {
  it("enumerates nested CLAUDE.md / AGENTS.md with bytes and depth", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "CLAUDE.md": "# root\n",
      "src/auth/CLAUDE.md": "# auth subsystem\n\nNotes for the auth code.\n",
      "src/auth/AGENTS.md": "# auth agents\n",
      "packages/api/v1/CLAUDE.md": "# v1 api\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);

    const r = await readReport(cwd);

    // Root CLAUDE.md stays in docs[], not in nestedContextFiles
    expect(r.docs.some((d) => d.kind === "claude-md" && d.path === "CLAUDE.md")).toBe(true);
    expect(r.nestedContextFiles.find((f) => f.path === "CLAUDE.md")).toBeUndefined();

    const paths = r.nestedContextFiles.map((f) => f.path).sort();
    expect(paths).toEqual([
      "packages/api/v1/CLAUDE.md",
      "src/auth/AGENTS.md",
      "src/auth/CLAUDE.md",
    ]);

    const auth = r.nestedContextFiles.find((f) => f.path === "src/auth/CLAUDE.md")!;
    expect(auth.kind).toBe("claude-md");
    expect(auth.bytes).toBeGreaterThan(0);
    expect(auth.depth).toBe(2);

    const agents = r.nestedContextFiles.find((f) => f.path === "src/auth/AGENTS.md")!;
    expect(agents.kind).toBe("agents-md");
  });

  it("flags context-rot risk on oversize CLAUDE.md (≥ 32 KiB)", async () => {
    const big = "a".repeat(33_000);
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "src/CLAUDE.md": big,
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);

    const r = await readReport(cwd);
    const signal = r.staleSignals.find(
      (s) => s.path === "src/CLAUDE.md" && s.reason.includes("context-rot"),
    );
    expect(signal).toBeDefined();
    expect(signal!.kind).toBe("claude-md");
  });

  it("ignores CLAUDE.md inside node_modules / dist / .git", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "node_modules/foo/CLAUDE.md": "# noise\n",
      "dist/CLAUDE.md": "# noise\n",
      "src/CLAUDE.md": "# real\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);

    const r = await readReport(cwd);
    const paths = r.nestedContextFiles.map((f) => f.path);
    expect(paths).toEqual(["src/CLAUDE.md"]);
  });
});

describe("agent-readiness — cross-tool config detection", () => {
  it("detects expanded Claude Code, Cursor, and Copilot config surfaces", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      ".mcp.json": "{}",
      ".claude/settings.json": "{}",
      ".claude/agents/reviewer.md": "# reviewer\n",
      ".claude/skills/foo/SKILL.md": "# foo\n",
      ".cursor/rules/style.mdc": "---\nalwaysApply: true\n---\n",
      ".cursor/environment.json": "{}",
      ".github/instructions/api.instructions.md": "---\napplyTo: 'src/api/**'\n---\n",
      ".github/workflows/copilot-setup-steps.yml": "name: copilot-setup-steps\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);

    const r = await readReport(cwd);
    const claude = r.configs.find((c) => c.tool === "claude-code");
    expect(claude?.paths).toEqual(
      expect.arrayContaining([
        ".mcp.json",
        ".claude/settings.json",
        ".claude/agents",
        ".claude/skills",
      ]),
    );
    const cursor = r.configs.find((c) => c.tool === "cursor");
    expect(cursor?.paths).toEqual(
      expect.arrayContaining([".cursor/rules", ".cursor/environment.json"]),
    );
    const copilot = r.configs.find((c) => c.tool === "github-copilot");
    expect(copilot?.paths).toEqual(
      expect.arrayContaining([
        ".github/instructions",
        ".github/workflows/copilot-setup-steps.yml",
      ]),
    );
  });
});

describe("agent-readiness — monorepo detection", () => {
  it("flags pnpm workspace + missing per-package context", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "packages/api/package.json": "{}",
      "packages/web/package.json": "{}",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);

    const r = await readReport(cwd);
    expect(r.monorepo.isMonorepo).toBe(true);
    expect(r.monorepo.markers).toContain("pnpm-workspace.yaml");
    const sig = r.staleSignals.find((s) => s.kind === "monorepo");
    expect(sig).toBeDefined();
    expect(sig!.reason).toContain("monorepo");
  });

  it("does not flag monorepo when nested context exists", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "packages/api/CLAUDE.md": "# api\n",
      "packages/web/AGENTS.md": "# web\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);

    const r = await readReport(cwd);
    expect(r.monorepo.isMonorepo).toBe(true);
    expect(r.staleSignals.find((s) => s.kind === "monorepo")).toBeUndefined();
  });

  it("detects workspaces field in package.json and Cargo workspace marker", async () => {
    const cwdNpm = await makeRepoFixture({
      "package.json": JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
    });
    const npmRes = await runCli(["scan", "--no-fitness"], { cwd: cwdNpm });
    expect(npmRes.code).toBe(0);
    const r1 = await readReport(cwdNpm);
    expect(r1.monorepo.markers).toContain("package.json:workspaces");

    const cwdCargo = await makeRepoFixture({
      "Cargo.toml": "[workspace]\nmembers = [\"crates/*\"]\n",
    });
    const cargoRes = await runCli(["scan", "--no-fitness"], { cwd: cwdCargo });
    expect(cargoRes.code).toBe(0);
    const r2 = await readReport(cwdCargo);
    expect(r2.monorepo.markers).toContain("Cargo.toml:[workspace]");
  });
});

describe("agent-readiness — local-config gitignore audit", () => {
  it("flags missing CLAUDE.local.md / settings.local.json patterns when Claude is in use", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "CLAUDE.md": "# demo\n",
      ".gitignore": "node_modules/\ndist/\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);
    const r = await readReport(cwd);
    expect(r.localConfigIgnored.hasGitignore).toBe(true);
    expect(r.localConfigIgnored.ignoresClaudeLocalMd).toBe(false);
    expect(r.localConfigIgnored.ignoresClaudeSettingsLocal).toBe(false);
    const sigs = r.staleSignals.filter((s) => s.kind === "local-config");
    expect(sigs).toHaveLength(2);
    expect(sigs.map((s) => s.reason).join(" ")).toContain("CLAUDE.local.md");
    expect(sigs.map((s) => s.reason).join(" ")).toContain("settings.local.json");
  });

  it("does not flag when patterns are present", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "CLAUDE.md": "# demo\n",
      ".gitignore":
        "node_modules/\nCLAUDE.local.md\n.claude/settings.local.json\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);
    const r = await readReport(cwd);
    expect(r.localConfigIgnored.ignoresClaudeLocalMd).toBe(true);
    expect(r.localConfigIgnored.ignoresClaudeSettingsLocal).toBe(true);
    expect(r.staleSignals.find((s) => s.kind === "local-config")).toBeUndefined();
  });

  it("stays silent when Claude is not in use", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      ".gitignore": "node_modules/\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);
    const r = await readReport(cwd);
    expect(r.staleSignals.find((s) => s.kind === "local-config")).toBeUndefined();
  });
});

describe("agent-readiness — fitness command reachability", () => {
  it("flags package.json scripts not mentioned in any agent-context doc", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "package.json": JSON.stringify({
        scripts: { test: "vitest", build: "tsc" },
      }),
      "CLAUDE.md": "# project\n\nThis is a demo project.\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);
    const r = await readReport(cwd);
    expect(r.fitnessReachability.declaredCommands.test).toBe("npm test");
    expect(r.fitnessReachability.declaredCommands.build).toBe("npm run build");
    expect(r.fitnessReachability.reachable).toBe(false);
    const sig = r.staleSignals.find((s) => s.kind === "fitness");
    expect(sig).toBeDefined();
    expect(sig!.reason).toContain("test");
    expect(sig!.reason).toContain("build");
  });

  it("counts CLAUDE.md mentioning npm test as reachable", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "package.json": JSON.stringify({
        scripts: { test: "vitest", build: "tsc" },
      }),
      "CLAUDE.md": "# project\n\nRun `npm test` then `npm run build`.\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);
    const r = await readReport(cwd);
    expect(r.fitnessReachability.reachable).toBe(true);
    expect(r.fitnessReachability.contextDocsMentioning).toContain("CLAUDE.md");
    expect(r.staleSignals.find((s) => s.kind === "fitness")).toBeUndefined();
  });

  it("counts a filled .agent.toml [commands] block as reachable", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
      "package.json": JSON.stringify({ scripts: { test: "vitest" } }),
      ".agent.toml": '[commands]\ntest = "npm test"\nbuild = ""\n',
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);
    const r = await readReport(cwd);
    expect(r.fitnessReachability.reachable).toBe(true);
    expect(r.fitnessReachability.contextDocsMentioning).toContain(".agent.toml");
  });

  it("treats no declared commands as reachable (nothing to document)", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);
    const r = await readReport(cwd);
    expect(r.fitnessReachability.reachable).toBe(true);
    expect(r.staleSignals.find((s) => s.kind === "fitness")).toBeUndefined();
  });
});
