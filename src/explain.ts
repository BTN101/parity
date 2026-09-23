/**
 * Explanations, tied to the source.
 *
 * Deterministic on purpose. Every sentence here is derived from the parsed
 * program and the observed counterexample — the declaration line, the PICTURE,
 * the statement that wrote the value. A model paraphrasing a divergence can be
 * wrong in convincing ways; a template filled from facts cannot. Bob does the
 * reasoning about *how to fix it*; Parity only states what is true.
 */

import type { Assignment, CobolProgram } from "./cobol/parse.js";
import { storageOf } from "./cobol/parse.js";
import { describePic, maxMagnitude } from "./cobol/pic.js";
import type { Kind } from "./classify.js";

export interface SourceRef {
  line: number;
  text: string;
  role: "declaration" | "write";
}

export interface Explanation {
  headline: string;
  detail: string;
  refs: SourceRef[];
  /** What preserving the legacy behaviour would take, for the repair loop. */
  preserveHint: string;
}

/** Writes to a field and, transitively, to the fields it is computed from. */
function upstreamWrites(prog: CobolProgram, name: string, depth = 4, seen = new Set<string>()): Assignment[] {
  if (depth === 0 || seen.has(name)) return [];
  seen.add(name);
  const writes = prog.assignments.filter((a) => a.target === name);
  const out = [...writes];
  for (const w of writes) {
    const t = w.text.toUpperCase();
    const rhs = w.verb === "COMPUTE" ? t.split("=").slice(1).join("=") : t.replace(/^\w+\s+/, "");
    for (const tok of rhs.match(/[A-Z][A-Z0-9-]*/g) ?? []) {
      if (prog.items.has(tok) && tok !== name) out.push(...upstreamWrites(prog, tok, depth - 1, seen));
    }
  }
  return out;
}

export function explain(prog: CobolProgram, field: string, kind: Kind, legacy: string, modern: string, from?: string): Explanation {
  const s = storageOf(prog, field);
  const item = s?.item ?? prog.items.get(field);
  const refs: SourceRef[] = [];
  if (item) refs.push({ line: item.line, text: prog.sourceLines[item.line - 1].trim(), role: "declaration" });
  for (const w of s?.writes ?? []) refs.push({ line: w.line, text: w.text, role: "write" });

  const name = item?.name ?? field;
  const pic = item ? `PIC ${item.pic.raw}` : "";
  const desc = item ? describePic(item.pic) : "";

  switch (kind) {
    case "sign-loss":
      return {
        headline: `${name} silently drops negative signs`,
        detail:
          `${name} is declared ${pic} (${desc}). When a result is negative, the legacy program stores its ` +
          `absolute value. Legacy: ${legacy}. Modern: ${modern}. A negative becomes a positive — a debt becomes a credit.`,
        refs,
        preserveHint: `Store ${name} through Pic.store(value, "${item?.pic.raw}") so negative results lose their sign exactly as the legacy field does.`,
      };
    case "high-order-truncation":
    case "sign-loss+truncation":
      return {
        headline: `${name} silently loses leading digits on overflow`,
        detail:
          `${name} is declared ${pic} (${desc}), so it cannot hold ${item ? maxMagnitude(item.pic).toLocaleString("en-US") : "larger values"} ` +
          `or more. With no ON SIZE ERROR clause, larger results are stored with their high-order digits cut off` +
          `${kind === "sign-loss+truncation" ? " — and, being unsigned, without their sign" : ""}. ` +
          `Legacy: ${legacy}. Modern: ${modern}.`,
        refs,
        preserveHint: `Store ${name} through Pic.store(value, "${item?.pic.raw}") to truncate high-order digits${kind === "sign-loss+truncation" ? " and drop the sign" : ""} the way the legacy field does.`,
      };
    case "rounding": {
      const chain = upstreamWrites(prog, name);
      const rounded = chain.filter((x) => x.rounded);
      for (const r of rounded) if (!refs.some((x) => x.line === r.line)) refs.push({ line: r.line, text: r.text, role: "write" });
      const detail = rounded.length
        ? `The legacy value passes through ROUNDED at line${rounded.length > 1 ? "s" : ""} ${rounded.map((r) => r.line).sort((a, b) => a - b).join(", ")}. ` +
          `COBOL's ROUNDED rounds halves away from zero; a modern rounding mode that rounds halves to even (banker's rounding) ` +
          `or truncates disagrees on exactly the half-step cases — which is why ordinary test data never catches it.`
        : `The legacy statement truncates, and COBOL carries intermediate results at its own precision before storing. ` +
          `The modern arithmetic does not reproduce that precision. This is the class of difference that cannot be ` +
          `reasoned out — only executed.`;
      return {
        headline: `${name} differs by one step in the last decimal`,
        detail: `Legacy: ${legacy}. Modern: ${modern}. ${detail}`,
        refs,
        preserveHint: rounded.length
          ? `Round with RoundingMode.HALF_UP (half away from zero) wherever the legacy code says ROUNDED — Pic.storeRounded() does this.`
          : `Reproduce the legacy intermediate precision for ${name}; the minimal counterexample pins the exact case.`,
      };
    }
    case "propagated":
      return {
        headline: `${field} differs because ${from} differs`,
        detail: `${field} is computed from ${from}. It will match once ${from} does. Legacy: ${legacy}. Modern: ${modern}.`,
        refs,
        preserveHint: `No separate fix — resolve ${from} first.`,
      };
    case "input-overflow": {
      const inItem = prog.items.get(field);
      return {
        headline: `Input ${field} larger than its field is truncated on the way in`,
        detail:
          `${field} is declared PIC ${inItem?.pic.raw} (${inItem ? describePic(inItem.pic) : ""}). An input of ${modern} ` +
          `cannot fit, and the legacy program silently keeps only the low-order digits. The modern code uses the full value.`,
        refs: inItem ? [{ line: inItem.line, text: prog.sourceLines[inItem.line - 1].trim(), role: "declaration" }] : [],
        preserveHint: `Either reject out-of-range ${field} in both systems, or apply Pic.store(value, "${inItem?.pic.raw}") on input.`,
      };
    }
    case "input-sign-loss": {
      const inItem = prog.items.get(field);
      return {
        headline: `Negative ${field} input loses its sign on the way in`,
        detail: `${field} is unsigned (PIC ${inItem?.pic.raw}). An input of ${modern} is stored as its absolute value by the legacy program.`,
        refs: inItem ? [{ line: inItem.line, text: prog.sourceLines[inItem.line - 1].trim(), role: "declaration" }] : [],
        preserveHint: `Either reject negative ${field} in both systems, or take the absolute value on input as the legacy field does.`,
      };
    }
    case "format":
      return {
        headline: `${field} has the same value but different text`,
        detail: `Legacy prints "${legacy}", modern prints "${modern}". Downstream systems reading this output as fixed-width text will see a different record.`,
        refs,
        preserveHint: `Format ${field} to the legacy edited picture exactly.`,
      };
    case "crash":
      return {
        headline: `Modern code produced no usable ${field}`,
        detail: `Legacy: ${legacy}. Modern: "${modern}". The modern program errored or wrote nothing for this input.`,
        refs,
        preserveHint: `Handle this input without failing; the legacy program accepts it.`,
      };
    default:
      return {
        headline: `${field} differs`,
        detail: `Legacy: ${legacy}. Modern: ${modern}. No known COBOL storage behaviour accounts for the difference — likely a logic difference in the translation.`,
        refs,
        preserveHint: `Compare the translated logic for ${field} against the legacy statements listed.`,
      };
  }
}
