#!/usr/bin/env node
import { runList } from "./commands/list.js";
import { runDoctor } from "./commands/doctor.js";

const VERSION = "0.0.0";

const HELP = `agentry ${VERSION}

Form your agentic readiness.

Usage:
  agentry list                      List catalog entries
  agentry doctor [path]             Audit a repo's agent-readiness (default: cwd)
  agentry add <id>                  Install an installable piece of the harness
  agentry coach <id>                Interactively author an un-installable piece
  agentry --help                    Show this message
  agentry --version                 Show version

Flags:
  --show-deprecated                 (list) include deprecated entries

Status: Phase 2.0 — list and doctor are implemented. add/coach are stubs.
See https://github.com/esbenwiberg/agentry`;

interface ParsedArgs {
  verb: string | undefined;
  positional: string[];
  flags: Set<string>;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Set<string>();
  for (const a of argv) {
    if (a.startsWith("--")) flags.add(a);
    else positional.push(a);
  }
  const [verb, ...rest] = positional;
  return { verb, positional: rest, flags };
}

function main(argv: readonly string[]): number {
  const args = argv.slice(2);
  const { verb, positional, flags } = parseArgs(args);

  if (!verb || flags.has("--help") || verb === "--help" || verb === "-h") {
    console.log(HELP);
    return 0;
  }
  if (flags.has("--version") || verb === "--version" || verb === "-v") {
    console.log(VERSION);
    return 0;
  }

  switch (verb) {
    case "list":
      return runList({ showDeprecated: flags.has("--show-deprecated") });
    case "doctor": {
      const cwd = positional[0] ?? process.cwd();
      return runDoctor({ cwd });
    }
    case "add":
    case "coach":
      console.error(`agentry ${verb}: not implemented yet (Phase 2.0).`);
      return 2;
    default:
      console.error(`agentry: unknown command '${verb}'.`);
      console.error(`Try 'agentry --help'.`);
      return 1;
  }
}

process.exit(main(process.argv));
