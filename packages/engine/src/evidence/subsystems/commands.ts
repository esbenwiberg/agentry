import { spawn } from "node:child_process";
import type { CommandRun, CommandSpec, CommandsEvidence, GatherContext } from "../../sdk/types.js";
import { startTimer } from "../../util/timing.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 1_048_576;

export const commandsSubsystem = {
  gather(ctx: GatherContext): CommandsEvidence {
    return {
      async run(spec: CommandSpec): Promise<CommandRun> {
        const cwd = spec.cwd ?? ctx.cwd;
        const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const warmup = spec.warmup ?? 0;

        for (let i = 0; i < warmup; i += 1) {
          await execOne(spec.argv, cwd, timeoutMs, spec.env);
        }

        return execOne(spec.argv, cwd, timeoutMs, spec.env);
      },
    };
  },
};

function execOne(
  argv: string[],
  cwd: string,
  timeoutMs: number,
  env: Record<string, string> | undefined,
): Promise<CommandRun> {
  const [command, ...args] = argv;
  if (command === undefined) {
    return Promise.resolve({
      exitCode: null,
      durationMs: 0,
      stdout: "",
      stderr: "argv is empty",
      timedOut: false,
    });
  }

  return new Promise((resolve) => {
    const elapsed = startTimer();
    const child = spawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += chunk.toString(
          "utf8",
          0,
          Math.min(chunk.length, MAX_OUTPUT_BYTES - stdout.length),
        );
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += chunk.toString(
          "utf8",
          0,
          Math.min(chunk.length, MAX_OUTPUT_BYTES - stderr.length),
        );
      }
    });

    const finish = (run: CommandRun) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(run);
    };

    child.on("error", (err) => {
      finish({
        exitCode: null,
        durationMs: elapsed(),
        stdout,
        stderr: stderr || err.message,
        timedOut,
      });
    });

    child.on("close", (code) => {
      finish({
        exitCode: code,
        durationMs: elapsed(),
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}
