#!/usr/bin/env node
/**
 * agentry — form your agentic readiness.
 *
 * Phase 0 stub. Real verbs (doctor / add / coach) land in subsequent
 * phases. See docs/adr/0001-product-posture-doctor-add-coach.md.
 */

const VERSION = "0.0.0";

const HELP = `agentry ${VERSION}

Form your agentic readiness.

Usage:
  agentry doctor          Audit a repo's agent-readiness across 7 layers
  agentry add <thing>     Install an installable piece of the harness
  agentry coach <thing>   Interactively author an un-installable piece
  agentry --help          Show this message
  agentry --version       Show version

Status: Phase 0. Verbs are not implemented yet.
See https://github.com/esbenwiberg/agentry`;

function main(argv: readonly string[]): number {
  const [, , ...args] = argv;

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return 0;
  }

  if (args[0] === "--version" || args[0] === "-v") {
    console.log(VERSION);
    return 0;
  }

  const verb = args[0];
  if (verb === "doctor" || verb === "add" || verb === "coach") {
    console.error(`agentry ${verb}: not implemented yet (Phase 0).`);
    return 2;
  }

  console.error(`agentry: unknown command '${verb}'.`);
  console.error(`Try 'agentry --help'.`);
  return 1;
}

process.exit(main(process.argv));
