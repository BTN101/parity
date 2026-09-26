export type Verdict = "EQUIVALENT" | "EQUIVALENT_WITH_DECLARED_CHANGES" | "DIVERGENT";
export type Strategy = "boundary" | "harvested" | "random";

export interface Example { input: string; legacy: string; modern: string }
export interface SourceRef { line: number; text: string; role: "declaration" | "write" }
export interface LedgerEntry { decision: "preserve" | "accept"; rationale: string; decidedAt: string; decidedBy: string }

export interface Finding {
  key: string;
  field: string;
  kind: string;
  derived: boolean;
  from?: string;
  count: number;
  share: number;
  firstSeenAt: number;
  byStrategy: Record<Strategy, number>;
  example: Example;
  minimal: Example & { shrinkRounds: number };
  explanation: { headline: string; detail: string; refs: SourceRef[]; preserveHint: string };
  decision?: LedgerEntry;
  status: "open" | "preserve" | "accepted";
}

export interface Report {
  program: string;
  source: string;
  modernLabel: string;
  dialect: string;
  inputs: string[];
  outputs: string[];
  generatedAt: string;
  seed: number;
  inputsRun: number;
  durationMs: number;
  throughput: number;
  domains: Array<{ name: string; pic: string; description: string; harvested: number[]; values: string[] }>;
  strategies: Record<Strategy, { inputs: number; divergent: number; firstFindAt: number | null }>;
  divergentInputs: number;
  findings: Finding[];
  resolvedDecisions: Array<{ key: string } & LedgerEntry>;
  coverage: {
    statements: { hit: number; total: number };
    decisions: { bothWays: number; total: number; oneWay: number[] };
    missedLines: number[];
    statementLines: number[];
    sampled: number;
  };
  verdict: Verdict;
  summary: string;
}

export interface Scenario {
  id: string;
  program: string;
  stage: "first-draft" | "after-repair" | "uploaded";
  stageLabel: string;
  report: Report;
  source: string;
}
