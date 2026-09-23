/**
 * PICTURE clause semantics.
 *
 * A COBOL field's PICTURE is its type, its range and its storage behaviour at
 * once. `PIC S9(7)V99` is a signed number with seven integer digits and two
 * implied decimals — and, crucially, anything larger than 9,999,999.99 that is
 * stored into it silently loses its leading digits. `PIC 9(7)V99` is the same
 * without the S, which means a negative value stored into it silently loses
 * its sign.
 *
 * Those two behaviours are where modern translations quietly diverge, because
 * no modern numeric type does either. Parity reads the pictures so it knows
 * exactly where to aim.
 */

export type FieldKind = "numeric" | "edited" | "alphanumeric";

export interface PicSpec {
  raw: string;
  kind: FieldKind;
  /** Has an S (numeric) or a sign insertion character (edited). */
  signed: boolean;
  /** Digit positions left of the decimal point. */
  intDigits: number;
  /** Digit positions right of the (implied or actual) decimal point. */
  scale: number;
  /** Character width, for alphanumeric fields. */
  width: number;
}

/** Expand repetition: 9(5)V9(2) → 99999V99. */
export function expandPic(pic: string): string {
  return pic.toUpperCase().replace(/(.)\((\d+)\)/g, (_, ch: string, n: string) => ch.repeat(Number(n)));
}

export function parsePic(raw: string): PicSpec {
  const p = expandPic(raw.replace(/\.$/, ""));

  if (/[XA]/.test(p)) {
    return { raw, kind: "alphanumeric", signed: false, intDigits: 0, scale: 0, width: p.length };
  }

  const edited = /[.Z*,+\-$B0/]|CR|DB/.test(p.replace(/^S/, ""));
  const pointAt = edited ? p.indexOf(".") : p.indexOf("V");
  const left = pointAt === -1 ? p : p.slice(0, pointAt);
  const right = pointAt === -1 ? "" : p.slice(pointAt + 1);

  // Digit positions: 9 and Z always; a run of floating sign characters counts
  // all but its first as digit positions ("---9" holds three digits).
  const digitsIn = (s: string): number => {
    let n = (s.match(/[9Z*]/g) ?? []).length;
    const run = s.match(/^[-+$]{2,}/);
    if (run) n += run[0].length - 1;
    return n;
  };

  return {
    raw,
    kind: edited ? "edited" : "numeric",
    signed: p.startsWith("S") || /[-+]|CR|DB/.test(p),
    intDigits: digitsIn(left),
    scale: digitsIn(right),
    width: p.length,
  };
}

/** Largest magnitude the field can hold. */
export function maxMagnitude(spec: PicSpec): number {
  return Number("9".repeat(Math.max(spec.intDigits, 1)) + (spec.scale ? "." + "9".repeat(spec.scale) : ""));
}

/** Smallest representable step. */
export function unit(spec: PicSpec): number {
  return Math.pow(10, -spec.scale);
}

export function describePic(spec: PicSpec): string {
  if (spec.kind === "alphanumeric") return `text, ${spec.width} chars`;
  const sign = spec.signed ? "signed" : "UNSIGNED";
  return `${sign}, ${spec.intDigits} integer digit${spec.intDigits === 1 ? "" : "s"}, ${spec.scale} decimal${spec.scale === 1 ? "" : "s"}`;
}
