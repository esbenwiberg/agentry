export type Location = {
  path: string;
  range?: { startLine: number; endLine?: number };
};

export type Severity = "info" | "warn" | "error";

export type InventoryItem = {
  location: Location;
  severity: Severity;
  message: string;
};

export type Reading =
  | { kind: "predicate"; value: boolean }
  | { kind: "count"; value: number; samples?: Location[] }
  | { kind: "magnitude"; value: number; unit: string }
  | { kind: "inventory"; items: InventoryItem[] }
  | { kind: "distribution"; samples: number[] }
  | { kind: "na"; reason: string }
  | { kind: "error"; error: string };

export type Band = { upTo?: number; score: number };

export type Direction = "positive" | "negative";

export type ScoreConfig =
  | { kind: "predicate"; direction: Direction }
  | { kind: "count"; direction: Direction; bands: Band[] }
  | { kind: "magnitude"; direction: Direction; bands: Band[] }
  | { kind: "inventory"; severityWeights: Record<Severity, number>; bands: Band[] }
  | {
      kind: "distribution";
      stat: "mean" | "median" | "p95" | "p99" | "max";
      bands: Band[];
    };

export type Tier = "static" | "derived" | "historical" | "executed" | "reasoned";

export type DimensionAssignment = { id: string; weight: number };

export type FixtureExpect = { reading: Reading; score: number };

export type Fixture = {
  name: string;
  evidence: Record<string, unknown>;
  expect: FixtureExpect;
};

export type Probe = {
  id: string;
  version: string;
  dimensions: DimensionAssignment[];
  tier: Tier;
  evidence: readonly string[];
  rationale: string;
  detect(ev: EvidenceMap): Promise<Reading>;
  score: ScoreConfig;
  remediation?: unknown;
  fixtures: Fixture[];
};

export type DimensionOverride = { probeId: string; weight: number };

export type DimensionRecipe = {
  id: string;
  name: string;
  description: string;
  gating: boolean;
  overrides?: DimensionOverride[];
};

export type FilesEvidence = {
  has(path: string): boolean;
};

export type GuidanceFile = {
  path: string;
  bytes: number;
};

export type AgentConfigEvidence = {
  guidance: GuidanceFile[];
  has(path: string): boolean;
};

export type EvidenceMap = {
  files: FilesEvidence;
  agent_config: AgentConfigEvidence;
};

export type GatherContext = {
  cwd: string;
};
