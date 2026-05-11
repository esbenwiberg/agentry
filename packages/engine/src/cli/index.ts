#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "../index.js";
import { check } from "./check.js";

const program = new Command();

program
  .name("repofit")
  .description("Measure how agent-friendly your repo is.")
  .version(`repofit ${VERSION}`, "-v, --version");

program
  .command("check", { isDefault: true })
  .description("Run probes against the repo and emit a fitness score.")
  .option("--probe <id>", "Run a single probe by id (debugging the corpus).")
  .option("--cwd <path>", "Working directory.", process.cwd())
  .action(async (opts: { probe?: string; cwd: string }) => {
    try {
      const exitCode = await check({
        cwd: opts.cwd,
        ...(opts.probe ? { probe: opts.probe } : {}),
      });
      process.exit(exitCode);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`repofit: ${message}`);
      process.exit(2);
    }
  });

await program.parseAsync(process.argv);
