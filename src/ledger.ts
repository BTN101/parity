/**
 * The decision ledger.
 *
 * Some divergences are translation bugs. Others are *legacy* bugs that the
 * business has been living with for decades — a field that turns debts into
 * credits, a total that wraps past a million. Faithfully copying those into
 * new code is not obviously right, and silently fixing them is not obviously
 * right either: on cutover day, real customers' numbers change.
 *
 * So Parity doesn't force equivalence. It forces a decision. Each finding is
 * either PRESERVED (the modern code must reproduce the legacy behaviour) or
 * ACCEPTED (an intentional, documented change). The ledger is committed next
 * to the code and becomes the audit trail of the migration — the artefact a
 * regulator or an auditor asks for.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Decision = "preserve" | "accept";

export interface LedgerEntry {
  decision: Decision;
  rationale: string;
  decidedAt: string;
  decidedBy: string;
}

export interface Ledger {
  program: string;
  entries: Record<string, LedgerEntry>;
}

export function ledgerPath(dir: string): string {
  return join(dir, "parity-ledger.json");
}

export function readLedger(dir: string, program: string): Ledger {
  const p = ledgerPath(dir);
  if (!existsSync(p)) return { program, entries: {} };
  return JSON.parse(readFileSync(p, "utf8")) as Ledger;
}

export function decide(dir: string, program: string, key: string, decision: Decision, rationale: string, decidedBy = "unknown"): Ledger {
  if (!rationale.trim()) throw new Error("parity: a decision needs a rationale — it is the audit trail");
  const ledger = readLedger(dir, program);
  ledger.entries[key] = { decision, rationale: rationale.trim(), decidedAt: new Date().toISOString(), decidedBy };
  writeFileSync(ledgerPath(dir), JSON.stringify(ledger, null, 2) + "\n", "utf8");
  return ledger;
}
