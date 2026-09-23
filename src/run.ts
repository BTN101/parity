/**
 * Batch differential runner.
 *
 * Both programs receive the same records on stdin in one batch and answer one
 * line per record. Spawning a process per input would cap throughput in the
 * hundreds per second; batching gets tens of thousands, which is the
 * difference between sampling behaviour and sweeping it.
 */

import { spawnSync } from "node:child_process";

const CHUNK = 5000;

export interface BatchResult {
  legacy: string[];
  modern: string[];
  /** Set when a leg exited non-zero or produced the wrong number of lines. */
  legacyError?: string;
  modernError?: string;
}

function runLeg(cmd: string, shell: boolean, input: string, cwd: string): { lines: string[]; error?: string } {
  const r = spawnSync(cmd, {
    input,
    cwd,
    shell,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: 120_000,
    env: { ...process.env, JAVA_TOOL_OPTIONS: "" },
  });
  const lines = (r.stdout ?? "").replace(/\n$/, "").split("\n");
  let error: string | undefined;
  if (r.error) error = r.error.message;
  else if (r.status !== 0) error = `exit ${r.status}: ${(r.stderr ?? "").split("\n").filter(Boolean).slice(-3).join(" | ")}`;
  return { lines, error };
}

export function runBoth(legacyBin: string, modernRun: string, records: string[], cwd: string): BatchResult {
  const legacy: string[] = [];
  const modern: string[] = [];
  let legacyError: string | undefined;
  let modernError: string | undefined;

  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const input = chunk.join("\n") + "\n";
    const a = runLeg(legacyBin, false, input, cwd);
    const b = runLeg(modernRun, true, input, cwd);
    // Pad short output so a crash mid-batch shows up per record, not as a shift.
    while (a.lines.length < chunk.length) a.lines.push("<no output>");
    while (b.lines.length < chunk.length) b.lines.push("<no output>");
    legacy.push(...a.lines.slice(0, chunk.length));
    modern.push(...b.lines.slice(0, chunk.length));
    legacyError ??= a.error;
    modernError ??= b.error;
  }
  return { legacy, modern, legacyError, modernError };
}

/** Run only the modern leg — for counterfactual re-runs. */
export function runModern(modernRun: string, records: string[], cwd: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const b = runLeg(modernRun, true, chunk.join("\n") + "\n", cwd);
    while (b.lines.length < chunk.length) b.lines.push("<no output>");
    out.push(...b.lines.slice(0, chunk.length));
  }
  return out;
}
