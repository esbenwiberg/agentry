#!/usr/bin/env node
import { runList } from "./commands/list.js";
import { runDoctor } from "./commands/doctor.js";
import { runAdd } from "./commands/add.js";

const VERSION = "0.0.0";

const HELP = `agentry ${VERSION}

Form your agentic readiness.

Usage:
  agentry list                      List catalog entries
  agentry doctor [path]             Audit a repo's agent-readiness (default: cwd)
  agentry add <id> [path]           Install a catalog entry into a repo (default: cwd)
  agentry coach <id>                Interactively author an un-installable piece
  agentry --help                    Show this message
  agentry --version                 Show version

Flags (list):
  --show-deprecated                 Include deprecated entries

Flags (add):
  --no-claude                       Skip files with flavor=claude
  --no-recipe                       Skip files with flavor=agnostic
  --non-interactive                 Don't prompt; defaults to keep-existing
  --dry-run                         Show what would happen, don't write

Status: Phase 2.1 — list/doctor/add are implemented. coach is a stub.
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

async function main(argv: readonly string[]): Promise<number> {
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
    case "add": {
      const id = positional[0];
      if (!id) {
        console.error(`agentry add: missing entry id`);
        console.error(`Usage: agentry add <id> [path]`);
        return 1;
      }
      const cwd = positional[1] ?? process.cwd();
      return runAdd({
        cwd,
        id,
        noClaude: flags.has("--no-claude"),
        noRecipe: flags.has("--no-recipe"),
        nonInteractive: flags.has("--non-interactive"),
        dryRun: flags.has("--dry-run"),
      });
    }
    case "coach":
      console.error(`agentry ${verb}: not implemented yet (Phase 2.1).`);
      return 2;
    default:
      console.error(`agentry: unknown command '${verb}'.`);
      console.error(`Try 'agentry --help'.`);
      return 1;
  }
}

main(process.argv).then(
  (code) => process.exit(code),
  (err) => {
    console.error(`agentry: unexpected error: ${(err as Error).message}`);
    process.exit(2);
  },
);
