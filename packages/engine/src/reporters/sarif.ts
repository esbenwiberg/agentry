import type { ProbeResult } from "../runner/tiered.js";
import type { Location, Probe } from "../sdk/types.js";
import type { ReportInput } from "./json.js";

type SarifLevel = "error" | "warning" | "note";

type SarifRegion = {
  startLine: number;
  endLine?: number;
};

type SarifLocation = {
  physicalLocation: {
    artifactLocation: { uri: string };
    region?: SarifRegion;
  };
};

type SarifResult = {
  ruleId: string;
  ruleIndex: number;
  level: SarifLevel;
  message: { text: string };
  locations: SarifLocation[];
  partialFingerprints?: Record<string, string>;
  properties?: Record<string, unknown>;
};

type SarifRule = {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  help?: { text: string };
  helpUri?: string;
  defaultConfiguration?: { level: SarifLevel };
  properties?: Record<string, unknown>;
};

type SarifLog = {
  $schema: "https://json.schemastore.org/sarif-2.1.0.json";
  version: "2.1.0";
  runs: [
    {
      tool: {
        driver: {
          name: "repofit";
          version: string;
          informationUri: string;
          rules: SarifRule[];
        };
      };
      results: SarifResult[];
      invocations: [{ executionSuccessful: boolean }];
      originalUriBaseIds?: { SRCROOT: { uri: string } };
    },
  ];
};

const REPOFIT_URL = "https://github.com/esbenwiberg/repofit";

export function renderSarif(input: ReportInput): string {
  return `${JSON.stringify(buildSarif(input), null, 2)}\n`;
}

export function buildSarif(input: ReportInput): SarifLog {
  const rules: SarifRule[] = [];
  const ruleIndex = new Map<string, number>();
  const results: SarifResult[] = [];

  for (const r of input.results) {
    const findings = findingsForResult(r);
    if (findings.length === 0) continue;

    let idx = ruleIndex.get(r.probe.id);
    if (idx === undefined) {
      idx = rules.length;
      ruleIndex.set(r.probe.id, idx);
      rules.push(buildRule(r.probe));
    }

    for (const finding of findings) {
      results.push({
        ruleId: r.probe.id,
        ruleIndex: idx,
        level: finding.level,
        message: { text: finding.message },
        locations: [physicalLocation(finding.location)],
        partialFingerprints: {
          "probeIdAndPath/v1": fingerprint(r.probe.id, finding.location.path),
        },
        properties: {
          tier: r.probe.tier,
          score: r.score ?? null,
        },
      });
    }
  }

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "repofit",
            version: input.corpus.version,
            informationUri: REPOFIT_URL,
            rules,
          },
        },
        results,
        invocations: [{ executionSuccessful: input.verdict.pass }],
      },
    ],
  };
}

type Finding = {
  level: SarifLevel;
  message: string;
  location: Location;
};

function findingsForResult(r: ProbeResult): Finding[] {
  const reading = r.reading;
  const probeId = r.probe.id;
  const remediation = r.probe.remediation ?? "";

  switch (reading.kind) {
    case "inventory":
      return reading.items.map((item) => ({
        level: severityToLevel(item.severity),
        message: `${probeId}: ${item.message}${remediation ? `\n\n${remediation}` : ""}`,
        location: item.location,
      }));

    case "count": {
      if (r.score === 100) return [];
      const samples = reading.samples ?? [];
      if (samples.length === 0) {
        return [
          {
            level: scoreToLevel(r.score),
            message: rootMessage(probeId, `count = ${reading.value}`, remediation),
            location: { path: "." },
          },
        ];
      }
      const level = scoreToLevel(r.score);
      return samples.map((loc) => ({
        level,
        message: `${probeId}: flagged by count probe${remediation ? `\n\n${remediation}` : ""}`,
        location: loc,
      }));
    }

    case "predicate": {
      if (reading.value) return [];
      return [
        {
          level: "warning",
          message: rootMessage(probeId, "predicate failed", remediation),
          location: { path: "." },
        },
      ];
    }

    case "magnitude": {
      if (r.score === 100) return [];
      return [
        {
          level: scoreToLevel(r.score),
          message: rootMessage(probeId, `${reading.value}${reading.unit}`, remediation),
          location: { path: "." },
        },
      ];
    }

    case "distribution": {
      if (r.score === 100) return [];
      return [
        {
          level: scoreToLevel(r.score),
          message: rootMessage(probeId, `n=${reading.samples.length}`, remediation),
          location: { path: "." },
        },
      ];
    }

    case "judge": {
      if (reading.score >= 80) return [];
      return [
        {
          level: scoreToLevel(reading.score),
          message: rootMessage(probeId, reading.rationale, remediation),
          location: { path: "." },
        },
      ];
    }

    default:
      return [];
  }
}

function rootMessage(probeId: string, summary: string, remediation: string): string {
  const head = `${probeId}: ${summary}`;
  return remediation ? `${head}\n\n${remediation}` : head;
}

function buildRule(probe: Probe): SarifRule {
  const tags = probe.dimensions.map((d) => d.id);
  return {
    id: probe.id,
    name: probe.id,
    shortDescription: { text: probe.id },
    fullDescription: { text: trim(probe.rationale) },
    ...(probe.remediation ? { help: { text: probe.remediation } } : {}),
    helpUri: `${REPOFIT_URL}#${probe.id}`,
    defaultConfiguration: { level: "warning" },
    properties: { tier: probe.tier, tags },
  };
}

function physicalLocation(loc: Location): SarifLocation {
  const region = loc.range
    ? {
        startLine: loc.range.startLine,
        ...(loc.range.endLine ? { endLine: loc.range.endLine } : {}),
      }
    : undefined;
  return {
    physicalLocation: {
      artifactLocation: { uri: loc.path === "." ? "." : loc.path },
      ...(region ? { region } : {}),
    },
  };
}

function severityToLevel(severity: "info" | "warn" | "error"): SarifLevel {
  switch (severity) {
    case "error":
      return "error";
    case "warn":
      return "warning";
    case "info":
      return "note";
  }
}

function scoreToLevel(score: number | null): SarifLevel {
  if (score === null) return "note";
  if (score < 25) return "error";
  if (score < 75) return "warning";
  return "note";
}

function trim(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function fingerprint(probeId: string, path: string): string {
  // Stable-ish fingerprint for SARIF result tracking across runs.
  // Hash isn't necessary — the string form is already stable and short.
  return `${probeId}|${path}`;
}
