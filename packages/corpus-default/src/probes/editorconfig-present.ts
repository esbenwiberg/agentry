import { fileExists } from "@esbenwiberg/repofit/sdk/recipes";

export default fileExists({
  id: "editorconfig.present",
  version: "1.0.0",
  dimensions: [{ id: "consistency", weight: 1 }],
  rationale: `
    .editorconfig declares indentation, line endings, and final-newline
    rules in a form every editor (and agent) can read. Without it, agents
    guess from surrounding code and may produce diffs that flicker
    formatting across files.
  `,
  remediation:
    "Add an `.editorconfig` at the repo root with at minimum `indent_style`, `indent_size`, `end_of_line`, and `insert_final_newline`. See https://editorconfig.org for the format.",
  path: ".editorconfig",
});
