import { fileExists } from "@esbenwiberg/repofit/sdk/recipes";

export default fileExists({
  id: "docs.contributing-present",
  version: "1.0.0",
  dimensions: [{ id: "context", weight: 1 }],
  rationale: `
    CONTRIBUTING.md tells an agent (and humans) how this project expects
    change to flow: branch naming, commit format, review process, where
    tests live. Without it, agents fall back to generic defaults that
    rarely match house style.
  `,
  path: "CONTRIBUTING.md",
});
