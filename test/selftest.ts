/**
 * Self-test. Prints the numbers the README quotes.
 *
 *   1. PICTURE parsing and classification, on known cases.
 *   2. No false positives: translations that faithfully reproduce COBOL
 *      storage must come back EQUIVALENT on every seed. A verifier that cries
 *      wolf is worse than none — people stop reading it.
 *   3. Detection: the ordinary translations must come back DIVERGENT with the
 *      specific behaviours we know are there.
 */

import { parsePic } from "../src/cobol/pic.js";
import { classifyRecord, type OutputModel } from "../src/classify.js";
import { check } from "../src/engine.js";

const G = "\x1b[32m", R = "\x1b[31m", D = "\x1b[2m", X = "\x1b[0m";
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) failures++;
  console.log(`  ${cond ? `${G}PASS` : `${R}FAIL`}${X} ${label}${!cond && detail ? `  ${D}${detail}${X}` : ""}`);
};

/* ---- 1. units -------------------------------------------------------- */
console.log(`\n${D}── PICTURE parsing ────────────────────────────────${X}`);
const p = (s: string) => {
  const x = parsePic(s);
  return `${x.kind}/${x.signed ? "S" : "U"}/${x.intDigits}.${x.scale}`;
};
ok("S9(7)V99 → signed numeric 7.2", p("S9(7)V99") === "numeric/S/7.2", p("S9(7)V99"));
ok("9V9999 → unsigned numeric 1.4", p("9V9999") === "numeric/U/1.4", p("9V9999"));
ok("9(3) → unsigned numeric 3.0", p("9(3)") === "numeric/U/3.0", p("9(3)"));
ok("-9(5).99 → signed edited 5.2", p("-9(5).99") === "edited/S/5.2", p("-9(5).99"));
ok("---9.99 → floating sign, 3 integer digits", p("---9.99") === "edited/S/3.2", p("---9.99"));
ok("X(20) → alphanumeric", p("X(20)").startsWith("alphanumeric"), p("X(20)"));

console.log(`\n${D}── Classification ─────────────────────────────────${X}`);
const model = (field: string, pic: string, deps: string[] = []): OutputModel => ({
  field,
  storage: { level: 1, name: field.replace("O-", ""), pic: parsePic(pic), line: 1 },
  deps,
});
const one = (pic: string, l: string, m: string) => classifyRecord([model("O-X", pic)], l, m, ",")[0]?.kind;
ok("unsigned field, negative modern → sign-loss", one("9(7)V99", "0000012.50", "-12.50") === "sign-loss");
ok("overflow of S9(5)V99 → high-order-truncation", one("S9(5)V99", "97260.27", "197260.27") === "high-order-truncation");
ok("unsigned overflow, negative → sign-loss+truncation", one("9(3)V99", "987.49", "-9987.49") === "sign-loss+truncation");
ok("one cent apart → rounding", one("9(3)V99", "012.50", "012.49") === "rounding");
ok("same value, different text → format", one("9(3)V99", "012.50", "12.50") === "format");
ok("identical → nothing", one("9(3)V99", "012.50", "012.50") === undefined);
const chained = classifyRecord(
  [model("O-FEE", "9(3)V99"), model("O-NEW", "S9(7)V99", ["FEE"])],
  "007.50,0020007.50",
  "-7.50,0019992.51",
  ",",
);
ok("a field computed from a diverged field → propagated", chained[1]?.kind === "propagated" && chained[1]?.from === "O-FEE", JSON.stringify(chained));

/* ---- 2. no false positives -------------------------------------------- */
console.log(`\n${D}── No false positives (faithful translations) ─────${X}`);
const SEEDS = [11, 22, 33, 44, 55];
const N = 20000;
let clean = 0;
for (const ex of ["interest", "payroll"]) {
  for (const seed of SEEDS) {
    const r = check(`examples/${ex}/faithful`, { n: N, seed });
    const good = r.verdict === "EQUIVALENT";
    if (good) clean += N;
    ok(`${ex} faithful, seed ${seed}: ${r.verdict}`, good, r.findings.map((f) => `${f.key}×${f.count} ${f.minimal.input}`).join("; "));
  }
}
console.log(`  ${D}${clean.toLocaleString("en-US")} inputs, zero divergences reported${X}`);

/* ---- 3. detection ------------------------------------------------------ */
console.log(`\n${D}── Detection (ordinary translations) ──────────────${X}`);
const interest = check("examples/interest", { n: N, seed: 1 });
const ik = new Set(interest.findings.map((f) => f.key));
ok("interest: DIVERGENT", interest.verdict === "DIVERGENT");
ok("interest: NEW-BAL sign loss (debt → credit)", ik.has("O-NEW:sign-loss"));
ok("interest: INTEREST high-order truncation", ik.has("O-INT:high-order-truncation"));
ok("interest: FEE intermediate-precision rounding", ik.has("O-FEE:rounding"));
ok("interest: minimal sign-loss counterexample is the zero-balance account", interest.findings.find((f) => f.key === "O-NEW:sign-loss")?.minimal.input === "S,0.00,0.0000,0");

const payroll = check("examples/payroll", { n: N, seed: 1 });
const pk = new Set(payroll.findings.map((f) => f.key));
ok("payroll: DIVERGENT", payroll.verdict === "DIVERGENT");
ok("payroll: banker's-rounding difference on GROSS", pk.has("O-GROSS:rounding"));
ok("payroll: banker's-rounding difference on TAX", pk.has("O-TAX:rounding"));
ok("payroll: GROSS high-order truncation", pk.has("O-GROSS:high-order-truncation"));

console.log(`\n${D}── Numbers ────────────────────────────────────────${X}`);
for (const r of [interest, payroll]) {
  const roots = r.findings.filter((f) => !f.derived);
  console.log(
    `  ${r.program.padEnd(9)} ${r.throughput.toLocaleString("en-US")} pairs/s · ${r.divergentInputs.toLocaleString("en-US")}/${r.inputsRun.toLocaleString("en-US")} inputs diverge · ` +
      `${roots.length} root findings · coverage ${r.coverage.statements.hit}/${r.coverage.statements.total} stmts, ${r.coverage.decisions.bothWays}/${r.coverage.decisions.total} decisions`,
  );
  const s = r.strategies;
  console.log(`  ${"".padEnd(9)} first find: boundary #${s.boundary.firstFindAt} · harvested #${s.harvested.firstFindAt} · random #${s.random.firstFindAt}`);
}

console.log("");
if (failures) {
  console.log(`${R}FAILED${X} — ${failures}\n`);
  process.exit(1);
}
console.log(`${G}PASSED${X}\n`);
