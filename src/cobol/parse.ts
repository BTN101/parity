/**
 * A deliberately small COBOL reader.
 *
 * Not a compiler front end. It extracts exactly what Parity needs to aim its
 * inputs and explain its findings:
 *
 *   - every data item with a PICTURE, and the line it is declared on
 *   - every statement in the PROCEDURE DIVISION, with its line
 *   - every comparison against a literal (`IF BALANCE < 1000`), because the
 *     edges of those comparisons are where behaviour changes
 *   - the data flow into each output field (`MOVE NEW-BAL TO O-NEW`), because
 *     the field that *stores* a value decides whether its sign or leading
 *     digits survive — not the field that prints it
 *
 * Handles fixed-format source (sequence area, indicator column, area A/B).
 */

import { parsePic, type PicSpec } from "./pic.js";

export interface DataItem {
  level: number;
  name: string;
  pic: PicSpec;
  line: number;
  usage?: string;
  value?: string;
}

export interface Statement {
  line: number;
  verb: string;
  text: string;
}

export interface Assignment {
  target: string;
  line: number;
  verb: "COMPUTE" | "MOVE" | "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE";
  rounded: boolean;
  text: string;
  /** For MOVE: the source field or literal. */
  source?: string;
}

export interface Comparison {
  field: string;
  op: string;
  literal: number | string;
  line: number;
}

export interface CobolProgram {
  programId: string;
  items: Map<string, DataItem>;
  statements: Statement[];
  assignments: Assignment[];
  comparisons: Comparison[];
  /** Lines holding an IF, for branch-outcome coverage. */
  ifLines: number[];
  sourceLines: string[];
}

const VERBS = [
  "ACCEPT", "ADD", "CALL", "CLOSE", "COMPUTE", "CONTINUE", "DELETE", "DISPLAY", "DIVIDE",
  "EVALUATE", "EXIT", "GO", "GOBACK", "IF", "INITIALIZE", "INSPECT", "MOVE", "MULTIPLY",
  "OPEN", "PERFORM", "READ", "REWRITE", "SEARCH", "SET", "START", "STOP", "STRING",
  "SUBTRACT", "UNSTRING", "WRITE",
];
const VERB_RE = new RegExp(`^(${VERBS.join("|")})\\b`, "i");

/** Strip the sequence area and indicator column; drop comment lines. */
function codeArea(line: string): string | null {
  if (line.length >= 7 && (line[6] === "*" || line[6] === "/")) return null;
  if (/^\s*\*>/.test(line)) return null;
  const body = line.length > 7 ? line.slice(7, 72) : "";
  return body.replace(/\*>.*$/, "");
}

export function parseCobol(source: string): CobolProgram {
  const sourceLines = source.split(/\r?\n/);
  const items = new Map<string, DataItem>();
  const statements: Statement[] = [];
  const assignments: Assignment[] = [];
  const comparisons: Comparison[] = [];
  const ifLines: number[] = [];
  let programId = "UNKNOWN";

  let section: "id" | "data" | "procedure" | "other" = "other";

  sourceLines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const code = codeArea(raw);
    if (code === null) return;
    const text = code.trim();
    if (!text) return;
    const upper = text.toUpperCase();

    const pid = upper.match(/^PROGRAM-ID\.\s*([A-Z0-9-]+)/);
    if (pid) programId = pid[1];

    if (/^DATA\s+DIVISION/.test(upper)) section = "data";
    else if (/^PROCEDURE\s+DIVISION/.test(upper)) {
      section = "procedure";
      return;
    }

    if (section === "data") {
      const m = upper.match(/^(\d{1,2})\s+([A-Z0-9][A-Z0-9-]*)\b(.*)$/);
      if (m) {
        const rest = m[3];
        const pic = rest.match(/\bPIC(?:TURE)?\s+(?:IS\s+)?(\S+?)(?:\s|\.?$)/);
        if (pic) {
          const usage = rest.match(/\b(COMP(?:UTATIONAL)?(?:-\d)?|BINARY|PACKED-DECIMAL|DISPLAY)\b/);
          const value = rest.match(/\bVALUE\s+(?:IS\s+)?('.*?'|\S+?)\.?(?:\s|$)/);
          items.set(m[2], {
            level: Number(m[1]),
            name: m[2],
            pic: parsePic(pic[1]),
            line: lineNo,
            usage: usage?.[1],
            value: value?.[1],
          });
        }
      }
      return;
    }

    if (section !== "procedure") return;

    const verb = upper.match(VERB_RE);
    if (verb) {
      statements.push({ line: lineNo, verb: verb[1], text });
      if (verb[1] === "IF") ifLines.push(lineNo);
    }

    // Assignments: where values get stored, and whether rounding applies.
    const comp = upper.match(/^COMPUTE\s+([A-Z0-9-]+)(\s+ROUNDED)?\s*=/);
    if (comp) assignments.push({ target: comp[1], line: lineNo, verb: "COMPUTE", rounded: !!comp[2], text });

    const mv = upper.match(/^MOVE\s+(\S+)\s+TO\s+([A-Z0-9-]+)/);
    if (mv) assignments.push({ target: mv[2], line: lineNo, verb: "MOVE", rounded: false, text, source: mv[1] });

    // GIVING names the receiving field whenever present; otherwise it's the
    // operand after TO / FROM / BY / INTO.
    const arith =
      upper.match(/^(ADD|SUBTRACT|MULTIPLY|DIVIDE)\b.*?\bGIVING\s+([A-Z0-9-]+)(\s+ROUNDED)?/) ??
      upper.match(/^(ADD|SUBTRACT|MULTIPLY|DIVIDE)\b.*?\b(?:TO|FROM|BY|INTO)\s+([A-Z0-9-]+)(\s+ROUNDED)?/);
    if (arith) {
      assignments.push({
        target: arith[2],
        line: lineNo,
        verb: arith[1] as Assignment["verb"],
        rounded: !!arith[3],
        text,
      });
    }

    // Comparisons against literals: the edges where behaviour changes.
    const cmpRe = /([A-Z][A-Z0-9-]*)\s*(<=|>=|<|>|=|NOT\s*=|NOT\s*<|NOT\s*>|LESS\s+THAN|GREATER\s+THAN|EQUAL\s+TO)\s*(-?\d+(?:\.\d+)?|'[^']*')/g;
    let c: RegExpExecArray | null;
    while ((c = cmpRe.exec(upper)) !== null) {
      if (VERBS.includes(c[1])) continue;
      const lit = c[3].startsWith("'") ? c[3].slice(1, -1) : Number(c[3]);
      comparisons.push({ field: c[1], op: c[2].replace(/\s+/g, " "), literal: lit, line: lineNo });
    }
  });

  return { programId, items, statements, assignments, comparisons, ifLines, sourceLines };
}

/**
 * Follow an output field back to the item that actually stores the value.
 * `MOVE NEW-BAL TO O-NEW` means O-NEW only formats; NEW-BAL decides whether
 * the sign and leading digits survived.
 */
export function storageOf(prog: CobolProgram, outputField: string): { item: DataItem; writes: Assignment[] } | null {
  const mv = prog.assignments.find((a) => a.verb === "MOVE" && a.target === outputField);
  const storeName = mv?.source && prog.items.has(mv.source) ? mv.source : outputField;
  const item = prog.items.get(storeName);
  if (!item) return null;
  return { item, writes: prog.assignments.filter((a) => a.target === storeName) };
}
