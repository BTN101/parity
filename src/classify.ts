/**
 * Divergence classification.
 *
 * "Outputs differ" is useless to an engineer. Parity says *why*, by asking
 * which known COBOL storage behaviour, applied to the modern result, would
 * reproduce the legacy result exactly:
 *
 *   sign-loss              the storing field has no S; the sign was dropped
 *   high-order-truncation  the result outgrew the field; leading digits vanished
 *   rounding               off by one step in the last decimal
 *   propagated             this field differs only because a field it is
 *                          computed from already differed
 *   input-overflow         an input exceeded its PICTURE on the way in
 *   format                 same value, different text
 *   crash                  one side produced no usable output
 *
 * Classification is done against the field that *stores* the value (NEW-BAL),
 * not the one that prints it (O-NEW), because storage decides what survives.
 */

import type { CobolProgram, DataItem } from "./cobol/parse.js";
import { storageOf } from "./cobol/parse.js";
import { maxMagnitude } from "./cobol/pic.js";
import type { Domain } from "./gen.js";

export type Kind =
  | "sign-loss"
  | "high-order-truncation"
  | "sign-loss+truncation"
  | "rounding"
  | "value"
  | "propagated"
  | "input-overflow"
  | "input-sign-loss"
  | "format"
  | "crash";

export interface FieldDivergence {
  /** Output field, or input field for input-level kinds. */
  field: string;
  kind: Kind;
  legacy: string;
  modern: string;
  /** For propagated: the field it inherited from. */
  from?: string;
}

export interface OutputModel {
  field: string;
  storage: DataItem;
  /** Storage names this field's value is computed from. */
  deps: string[];
}

/** Parse COBOL edited output or loosely formatted modern output into scaled integers. */
export function toScaled(text: string, scale: number): bigint | null {
  const t = text.trim();
  if (!t || t === "<no output>") return null;
  const negative = /-/.test(t) || /(CR|DB)$/.test(t);
  const digits = t.replace(/[^0-9.]/g, "");
  if (!/\d/.test(digits)) return null;
  const [ip, fp = ""] = digits.split(".");
  const frac = (fp + "0".repeat(scale)).slice(0, scale);
  const v = BigInt((ip || "0") + frac);
  return negative ? -v : v;
}

function abs(v: bigint): bigint {
  return v < 0n ? -v : v;
}

export function modelOutputs(prog: CobolProgram, outputs: string[]): OutputModel[] {
  return outputs.map((field) => {
    const s = storageOf(prog, field);
    const storage = s?.item ?? prog.items.get(field)!;
    const deps = new Set<string>();
    for (const w of s?.writes ?? []) {
      // COMPUTE: everything right of "=". ADD/SUBTRACT/MULTIPLY/DIVIDE: every
      // operand in the statement other than the receiving field.
      const t = w.text.toUpperCase();
      const rhs = w.verb === "COMPUTE" ? t.split("=").slice(1).join("=") : t.replace(/^\w+\s+/, "");
      for (const tok of rhs.match(/[A-Z][A-Z0-9-]*/g) ?? []) {
        if (prog.items.has(tok) && tok !== storage.name) deps.add(tok);
      }
    }
    return { field, storage, deps: [...deps] };
  });
}

export function classifyInputs(domains: Domain[], fields: string[]): FieldDivergence[] {
  const out: FieldDivergence[] = [];
  domains.forEach((d, i) => {
    if (d.spec.kind === "alphanumeric") return;
    const v = Number(fields[i]);
    if (Math.abs(v) > maxMagnitude(d.spec)) out.push({ field: d.name, kind: "input-overflow", legacy: "", modern: fields[i] });
    else if (!d.spec.signed && v < 0) out.push({ field: d.name, kind: "input-sign-loss", legacy: "", modern: fields[i] });
  });
  return out;
}

export function classifyRecord(
  models: OutputModel[],
  legacyLine: string,
  modernLine: string,
  delimiter: string,
): FieldDivergence[] {
  const L = legacyLine.split(delimiter);
  const M = modernLine.split(delimiter);
  const found: FieldDivergence[] = [];

  models.forEach((m, i) => {
    const lt = (L[i] ?? "").trim();
    const mt = (M[i] ?? "").trim();
    if (lt === mt) return;

    const scale = m.storage.pic.scale;
    const lv = toScaled(lt, scale);
    const mv = toScaled(mt, scale);

    if (mv === null) return void found.push({ field: m.field, kind: "crash", legacy: lt, modern: mt });
    if (lv === null) return void found.push({ field: m.field, kind: "format", legacy: lt, modern: mt });
    if (lv === mv) return void found.push({ field: m.field, kind: "format", legacy: lt, modern: mt });

    const spec = m.storage.pic;
    const modulus = 10n ** BigInt(spec.intDigits + spec.scale);
    const overflow = abs(mv) >= modulus;
    const truncated = mv < 0n ? -(abs(mv) % modulus) : abs(mv) % modulus;

    let kind: Kind;
    if (!spec.signed && mv < 0n && !overflow && lv === abs(mv)) kind = "sign-loss";
    else if (overflow && spec.signed && lv === truncated) kind = "high-order-truncation";
    else if (overflow && !spec.signed && lv === abs(truncated)) kind = mv < 0n ? "sign-loss+truncation" : "high-order-truncation";
    // Overflow with a one-step residue: truncation upstream compounded by a
    // rounding difference. The truncation is the finding a person must decide.
    else if (overflow && abs(abs(lv) - abs(truncated)) <= 1n) kind = "high-order-truncation";
    else if (abs(lv - mv) === 1n) kind = "rounding";
    else if (!spec.signed && mv < 0n && abs(lv - abs(mv)) === 1n) kind = "sign-loss";
    else kind = "value";

    found.push({ field: m.field, kind, legacy: lt, modern: mt });
  });

  // A field that differs only because something it is computed from differed
  // is a consequence, not a cause. Report it, but don't make anyone decide it.
  const diverged = new Map(found.map((f) => [models.find((m) => m.field === f.field)!.storage.name, f.field]));
  for (const f of found) {
    if (f.kind !== "value" && f.kind !== "rounding") continue;
    const model = models.find((m) => m.field === f.field)!;
    const upstream = model.deps.find((d) => diverged.has(d) && diverged.get(d) !== f.field);
    if (upstream) {
      f.kind = "propagated";
      f.from = diverged.get(upstream);
    }
  }
  return found;
}

export function keyOf(d: FieldDivergence): string {
  return `${d.field}:${d.kind}`;
}

export const ROOT_KINDS: ReadonlySet<Kind> = new Set<Kind>([
  "sign-loss",
  "high-order-truncation",
  "sign-loss+truncation",
  "rounding",
  "value",
  "input-overflow",
  "input-sign-loss",
  "format",
  "crash",
]);
