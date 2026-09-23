/**
 * Coverage of the legacy program.
 *
 * "Zero divergences" means nothing if the inputs never reached half the code.
 * Parity runs a sample through a GnuCOBOL build compiled with -ftraceall,
 * which logs every statement executed, and reports two numbers:
 *
 *   statements  — PROCEDURE DIVISION statements executed at least once
 *   decisions   — IF statements seen to go *both* ways, judged by which line
 *                 executed next. An IF that only ever took one branch has
 *                 half its behaviour untested, however many inputs ran.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { CobolProgram } from "./cobol/parse.js";

export interface Coverage {
  statements: { hit: number; total: number };
  decisions: { bothWays: number; total: number; oneWay: number[] };
  missedLines: number[];
  sampled: number;
}

export function measureCoverage(prog: CobolProgram, tracedBin: string, records: string[], workDir: string): Coverage {
  const traceFile = join(workDir, "trace.log");
  rmSync(traceFile, { force: true });
  spawnSync(tracedBin, {
    input: records.join("\n") + "\n",
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, COB_SET_TRACE: "Y", COB_TRACE_FILE: traceFile },
  });

  let trace = "";
  try {
    trace = readFileSync(traceFile, "utf8");
  } catch {
    /* no trace means nothing executed */
  }

  const seq: number[] = [];
  // "Program-Id:  INTEREST   COMPUTE   Line:  42"            → a statement
  // "Program-Id:  INTEREST   Paragraph: MAIN   Line:  29"    → a label, skip
  for (const raw of trace.split("\n")) {
    const t = raw.trim().split(/\s+/);
    if (t[0] !== "Program-Id:" || t.length < 5) continue;
    if (t[2].endsWith(":")) continue;
    const line = Number(t[t.length - 1]);
    if (Number.isFinite(line)) seq.push(line);
  }

  const hit = new Set(seq);
  const statementLines = prog.statements.map((s) => s.line);
  const missedLines = statementLines.filter((l) => !hit.has(l));

  const successors = new Map<number, Set<number>>();
  for (let i = 0; i < seq.length - 1; i++) {
    if (prog.ifLines.includes(seq[i])) {
      if (!successors.has(seq[i])) successors.set(seq[i], new Set());
      successors.get(seq[i])!.add(seq[i + 1]);
    }
  }
  const oneWay = prog.ifLines.filter((l) => (successors.get(l)?.size ?? 0) < 2);

  return {
    statements: { hit: statementLines.length - missedLines.length, total: statementLines.length },
    decisions: { bothWays: prog.ifLines.length - oneWay.length, total: prog.ifLines.length, oneWay },
    missedLines,
    sampled: records.length,
  };
}
