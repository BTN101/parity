import type { CobolProgram } from "./parse.js";

export function branchNote(prog: CobolProgram, field: string, values: string[]): string {
  const branches = [...new Set(prog.comparisons.filter((c) => c.field === field && typeof c.literal === "string").map((c) => String(c.literal)))];
  const extra = values.filter((v) => !branches.includes(v));
  const parts: string[] = [];
  parts.push(
    branches.length
      ? `the code branches ONLY on ${branches.map((b) => `'${b}'`).join(", ")}; every other value takes the same path`
      : `the code never compares this field against a literal`,
  );
  if (extra.length) {
    const noun = extra.length === 1 ? "is an extra test value" : "are extra test values";
    parts.push(`${extra.join(", ")} ${noun} from parity.json, not branches in the code`);
  }
  return parts.join("; ");
}
