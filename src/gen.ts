/**
 * Input generation.
 *
 * Random inputs find divergences eventually. Aimed inputs find them first, and
 * find the ones random inputs never reach. Parity aims in three ways:
 *
 *   boundary   — from the PICTURE: zero, one step either side of zero, the
 *                field maximum, one step past it, and the opposite sign.
 *                This is where storage truncation and sign loss live.
 *   harvested  — from the PROCEDURE DIVISION: every literal a field is
 *                compared against, and one step either side. `IF BALANCE <
 *                1000` means 999.99, 1000.00 and 1000.01 behave differently
 *                and all three get tested.
 *   random     — log-uniform magnitudes across the field's range, so small
 *                and large values are both common rather than everything
 *                clustering near the maximum.
 *
 * Seeded, so every run and every counterexample is reproducible.
 */

import type { CobolProgram } from "./cobol/parse.js";
import { maxMagnitude, unit, type PicSpec } from "./cobol/pic.js";
import type { InputDecl } from "./contract.js";

export type Strategy = "boundary" | "harvested" | "random";

export interface Domain {
  name: string;
  spec: PicSpec;
  /** Numeric edges inside the field's range. */
  edges: number[];
  /** Values the field cannot hold: one step past the maximum, and negatives
   *  for unsigned fields. Real input files carry bad data, so these are tested
   *  too — but sparingly, so they don't drown out in-range findings. */
  outOfRange: number[];
  /** Constants this field is compared against in the code. */
  harvested: number[];
  /** Text values, for alphanumeric fields. */
  values: string[];
}

export interface GeneratedInput {
  fields: string[];
  strategy: Strategy;
}

/** mulberry32 — small, fast, seedable. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatNumber(v: number, scale: number): string {
  const s = v.toFixed(scale);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}

export function buildDomains(prog: CobolProgram, inputs: InputDecl[]): Domain[] {
  return inputs.map((decl) => {
    const item = prog.items.get(decl.name)!;
    const spec = item.pic;
    const cmp = prog.comparisons.filter((c) => c.field === decl.name);

    if (spec.kind === "alphanumeric") {
      const lits = cmp.map((c) => String(c.literal));
      const values = [...new Set([...(decl.values ?? []), ...lits])];
      if (!values.length) values.push("A");
      return { name: decl.name, spec, edges: [], outOfRange: [], harvested: [], values };
    }

    const u = unit(spec);
    const max = maxMagnitude(spec);
    const edges = new Set<number>([0, u, max, 10 ** Math.max(0, spec.intDigits - 1)]);
    if (spec.signed) for (const e of [...edges]) edges.add(-e);
    const outOfRange = [max + u, ...(spec.signed ? [-(max + u)] : [-u, -max])];
    const harvested = new Set<number>();
    for (const c of cmp) {
      if (typeof c.literal !== "number") continue;
      for (const d of [-u, 0, u]) harvested.add(Number((c.literal + d).toFixed(spec.scale)));
    }
    return { name: decl.name, spec, edges: [...edges], outOfRange, harvested: [...harvested], values: [] };
  });
}

function randomIn(d: Domain, r: () => number): number {
  const max = maxMagnitude(d.spec);
  const mag = Math.exp(Math.log(Math.max(unit(d.spec), 1e-9)) + r() * (Math.log(max) - Math.log(Math.max(unit(d.spec), 1e-9))));
  const neg = d.spec.signed && r() < 0.25;
  return neg ? -mag : mag;
}

function pick<T>(xs: T[], r: () => number): T {
  return xs[Math.floor(r() * xs.length)];
}

export function generate(domains: Domain[], n: number, seed: number): GeneratedInput[] {
  const r = rng(seed);
  const out: GeneratedInput[] = [];

  for (let i = 0; i < n; i++) {
    const roll = r();
    const strategy: Strategy = roll < 0.3 ? "boundary" : roll < 0.5 ? "harvested" : "random";
    // For harvested inputs, only one field sits on an edge; the rest vary.
    const focus = Math.floor(r() * domains.length);

    const fields = domains.map((d, idx) => {
      if (d.spec.kind === "alphanumeric") return pick(d.values, r);
      let v: number;
      if (strategy === "boundary") {
        const roll2 = r();
        v = roll2 < 0.04 ? pick(d.outOfRange, r) : roll2 < 0.7 ? pick(d.edges, r) : randomIn(d, r);
      }
      else if (strategy === "harvested" && idx === focus && d.harvested.length) v = pick(d.harvested, r);
      else v = randomIn(d, r);
      return formatNumber(v, d.spec.scale);
    });

    out.push({ fields, strategy });
  }
  return out;
}

/**
 * What the legacy program actually stores for an input: truncated to the
 * field's decimals, leading digits beyond its size dropped, sign dropped if
 * the field is unsigned. Used to ask the counterfactual "would the modern code
 * agree if it had been given what the legacy code kept?"
 */
export function asStored(d: Domain, raw: string): string {
  if (d.spec.kind === "alphanumeric") return raw;
  const scaled = BigInt(Math.trunc(Math.abs(Number(raw)) * 10 ** d.spec.scale + 1e-6));
  const modulus = 10n ** BigInt(d.spec.intDigits + d.spec.scale);
  let kept = scaled % modulus;
  const negative = Number(raw) < 0 && d.spec.signed && kept !== 0n;
  const str = kept.toString().padStart(d.spec.scale + 1, "0");
  const withPoint = d.spec.scale ? `${str.slice(0, -d.spec.scale)}.${str.slice(-d.spec.scale)}` : str;
  return (negative ? "-" : "") + withPoint;
}
