#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "../index.js";
import { errorMessage } from "../util/error-message.js";
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
  .option("--init", "Write a starter repofit.config.json and exit.")
  .option("--accept", "Run probes and write repofit-baseline.json with the current scores.")
  .option("--dirty", "Allow --accept with a dirty git working tree.")
  .action(
    async (opts: {
      probe?: string;
      cwd: string;
      init?: boolean;
      accept?: boolean;
      dirty?: boolean;
    }) => {
      try {
        const exitCode = await check({
          cwd: opts.cwd,
          probe: opts.probe,
          init: opts.init,
          accept: opts.accept,
          dirty: opts.dirty,
        });
        process.exit(exitCode);
      } catch (err) {
        console.error(`repofit: ${errorMessage(err)}`);
        process.exit(2);
      }
    },
  );

await program.parseAsync(process.argv);
