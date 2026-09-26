/**
 * Review state: what a person has decided about each difference, and how that
 * becomes a parity-ledger.json the CLI and the MCP server read on the next run.
 *
 * Decisions made in the browser are kept per reviewer in localStorage until they
 * are exported. The browser never changes the code; the ledger file is the hand-off.
 */

import type { Finding, LedgerEntry, Report, Scenario } from "./types";

export type Decision = "preserve" | "accept";
export type ReviewState = "open" | "preserve" | "accept" | "derived";

export type LocalDecisions = Record<string, LedgerEntry>;

/** Plain-English names for the mechanism behind each difference. */
export const KIND: Record<string, string> = {
  "sign-loss": "Minus sign lost",
  "sign-loss+truncation": "Minus sign and digits lost",
  "high-order-truncation": "Leading digits cut off",
  rounding: "Rounds differently",
  value: "Different result",
  propagated: "Follows from another difference",
  "input-overflow": "Input too large for its field",
  "input-sign-loss": "Negative input stored as positive",
  format: "Text formatting differs",
  crash: "Program crashed",
};

export const VERDICT = {
  DIVERGENT: {
    word: "Not equivalent",
    line: "The new code does not behave like the original yet.",
    tone: "red" as const,
  },
  EQUIVALENT_WITH_DECLARED_CHANGES: {
    word: "Equivalent, with declared changes",
    line: "The only differences left are changes a person accepted and signed.",
    tone: "green" as const,
  },
  EQUIVALENT: {
    word: "Equivalent",
    line: "No behavioural difference found.",
    tone: "green" as const,
  },
};

const storeKey = (sc: Scenario) => `parity.decisions.${sc.id}`;

export function loadLocal(sc: Scenario): LocalDecisions {
  try {
    return JSON.parse(localStorage.getItem(storeKey(sc)) ?? "{}");
  } catch {
    return {};
  }
}

export function saveLocal(sc: Scenario, d: LocalDecisions) {
  try {
    localStorage.setItem(storeKey(sc), JSON.stringify(d));
  } catch {
    /* private mode: decisions still work for this session */
  }
}

export function loadReviewer(): string {
  try {
    return localStorage.getItem("parity.reviewer") ?? "";
  } catch {
    return "";
  }
}

export function saveReviewer(name: string) {
  try {
    localStorage.setItem("parity.reviewer", name);
  } catch {
    /* ignore */
  }
}

/** The decision in force for a finding: a local one wins over the report's. */
export function decisionOf(f: Finding, local: LocalDecisions): LedgerEntry | undefined {
  return local[f.key] ?? f.decision;
}

export function stateOf(f: Finding, local: LocalDecisions): ReviewState {
  if (f.derived) return "derived";
  const d = decisionOf(f, local);
  if (d) return d.decision;
  if (f.status === "accepted") return "accept";
  if (f.status === "preserve") return "preserve";
  return "open";
}

export function counts(r: Report, local: LocalDecisions) {
  const c = { open: 0, preserve: 0, accept: 0, derived: 0 };
  for (const f of r.findings) c[stateOf(f, local)]++;
  return c;
}

/** Everything decided so far, in Parity's ledger format. */
export function buildLedger(r: Report, local: LocalDecisions) {
  const entries: Record<string, LedgerEntry> = {};
  for (const d of r.resolvedDecisions) {
    const { key, ...rest } = d;
    entries[key] = rest;
  }
  for (const f of r.findings) if (f.decision) entries[f.key] = f.decision;
  Object.assign(entries, local);
  return { program: r.program, entries };
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Split a comma-separated record, keeping each value's text as printed. */
export const cells = (rec: string) => rec.split(",").map((x) => x.trim());

export const fmt = (n: number) => n.toLocaleString("en-US");
export const pct = (x: number) => (x >= 0.1 ? `${Math.round(x * 100)}%` : x >= 0.001 ? `${(x * 100).toFixed(1)}%` : "<0.1%");
export const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
