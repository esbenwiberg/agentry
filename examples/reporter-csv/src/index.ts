// Example third-party reporter: emits one CSV row per probe.
//
// Wire it up in the consuming repo:
//
//   npm install --save-dev @example/repofit-reporter-csv
//
//   // repofit.config.json
//   {
//     "reporters": {
//       "plugins": [
//         { "package": "@example/repofit-reporter-csv",
//           "options": { "delimiter": "," } }
//       ]
//     }
//   }
//
//   $ repofit check --reporter csv=probes.csv
//
// The engine calls render() once with the structured report and the
// `options` block from config, and writes whatever string we return to
// the path the user passed.

import { defineReporter } from "@esbenwiberg/repofit/sdk";

type ProbeRow = {
  id: string;
  score: number | null;
  reading: string;
  dimension: string;
};

type ReportLike = {
  probes: ProbeRow[];
};

export default defineReporter({
  name: "csv",
  describe: "Emit one CSV row per probe (id, score, reading-kind, dimension).",

  render(ctx) {
    const delimiter = typeof ctx.options.delimiter === "string" ? ctx.options.delimiter : ",";
    const report = ctx.report as ReportLike;

    const header = ["id", "score", "reading", "dimension"].join(delimiter);
    const rows = report.probes.map((p) =>
      [
        csvEscape(p.id, delimiter),
        p.score === null ? "" : String(p.score),
        csvEscape(p.reading, delimiter),
        csvEscape(p.dimension, delimiter),
      ].join(delimiter),
    );
    return `${[header, ...rows].join("\n")}\n`;
  },
});

function csvEscape(value: string, delimiter: string): string {
  if (!value.includes(delimiter) && !value.includes('"') && !value.includes("\n")) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}
