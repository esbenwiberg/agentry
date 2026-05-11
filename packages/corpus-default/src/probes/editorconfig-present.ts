import { fileExists } from "@esbenwiberg/repofit/sdk/recipes";

export default fileExists({
  id: "editorconfig.present",
  version: "0.0.0",
  dimensions: [{ id: "consistency", weight: 1 }],
  rationale: `
    .editorconfig declares indentation, line endings, and final-newline
    rules in a form every editor (and agent) can read. Without it, agents
    guess from surrounding code and may produce diffs that flicker
    formatting across files.
  `,
  path: ".editorconfig",
});
