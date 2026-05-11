#!/usr/bin/env node
import { VERSION } from "../index.js";

const arg = process.argv[2];

if (arg === "--version" || arg === "-v") {
  console.log(`repofit ${VERSION}`);
  process.exit(0);
}

console.log(`repofit ${VERSION} (scaffold)`);
console.log("Phase 0 stub. Implementation begins in Phase 1.");
process.exit(0);
