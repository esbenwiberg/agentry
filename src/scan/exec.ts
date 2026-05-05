import { spawn } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}

export interface ExecOptions {
  cwd: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  maxOutputBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 2_000_000;

export async function execCmd(
  cmd: string,
  args: readonly string[],
  opts: ExecOptions,
): Promise<ExecResult> {
  const start = Date.now();
  return new Promise((resolveRes) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const cap = opts.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    let timedOut = false;
    let killed = false;

    const timeout = setTimeout(
      () => {
        timedOut = true;
        killed = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 2_000);
      },
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdoutBytes < cap) {
        stdout += chunk.toString("utf8");
        stdoutBytes += chunk.length;
        if (stdoutBytes >= cap) stdout += `\n... (truncated at ${cap} bytes)`;
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderrBytes < cap) {
        stderr += chunk.toString("utf8");
        stderrBytes += chunk.length;
        if (stderrBytes >= cap) stderr += `\n... (truncated at ${cap} bytes)`;
      }
    });
    child.on("error", () => {
      clearTimeout(timeout);
      resolveRes({
        stdout,
        stderr,
        exitCode: -1,
        timedOut,
        durationMs: Date.now() - start,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolveRes({
        stdout,
        stderr,
        exitCode: killed ? 124 : (code ?? -1),
        timedOut,
        durationMs: Date.now() - start,
      });
    });
  });
}
