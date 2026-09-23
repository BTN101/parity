/**
 * The check.
 *
 *   1. Read the COBOL. Derive an input domain from every input's PICTURE and
 *      from every literal the code compares it against.
 *   2. Generate tens of thousands of inputs, aimed at those edges.
 *   3. Run legacy and modern side by side in batches.
 *   4. Classify every disagreement by the COBOL storage behaviour that
 *      explains it, and collapse consequences onto their causes.
 *   5. Shrink one example of each finding to the simplest input that still
 *      shows it — a counterexample a person can read in one glance.
 *   6. Measure how much of the legacy program the inputs actually exercised.
 *   7. Join each finding to its recorded decision and issue a verdict.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prepare, type Loaded } from "./contract.js";
import { asStored, buildDomains, generate, formatNumber, type Domain, type Strategy } from "./gen.js";
import { runBoth, runModern } from "./run.js";
import {
  classifyInputs,
  classifyRecord,
  keyOf,
  modelOutputs,
  type FieldDivergence,
  type Kind,
  type OutputModel,
} from "./classify.js";
import { measureCoverage, type Coverage } from "./coverage.js";
import { explain, type Explanation } from "./explain.js";
import { readLedger, type LedgerEntry } from "./ledger.js";
import { describePic, maxMagnitude, unit } from "./cobol/pic.js";

export interface Example {
  input: string;
  legacy: string;
  modern: string;
}

export interface Finding {
  key: string;
  field: string;
  kind: Kind;
  /** True for consequences of another finding; resolved by fixing the cause. */
  derived: boolean;
  from?: string;
  count: number;
  share: number;
  firstSeenAt: number;
  byStrategy: Record<Strategy, number>;
  example: Example;
  minimal: Example & { shrinkRounds: number };
  explanation: Explanation;
  decision?: LedgerEntry;
  status: "open" | "preserve" | "accepted";
}

export type Verdict = "EQUIVALENT" | "EQUIVALENT_WITH_DECLARED_CHANGES" | "DIVERGENT";

export interface Report {
  program: string;
  source: string;
  modernLabel: string;
  dialect: string;
  /** Contract field names, in record order. */
  inputs: string[];
  outputs: string[];
  generatedAt: string;
  seed: number;
  inputsRun: number;
  durationMs: number;
  throughput: number;
  domains: Array<{ name: string; pic: string; description: string; harvested: number[]; values: string[] }>;
  strategies: Record<Strategy, { inputs: number; divergent: number; firstFindAt: number | null }>;
  divergentInputs: number;
  findings: Finding[];
  resolvedDecisions: Array<{ key: string } & LedgerEntry>;
  coverage: Coverage;
  verdict: Verdict;
  summary: string;
}

export interface CheckOptions {
  n?: number;
  seed?: number;
}

/* ------------------------------------------------------------------ */

function analyze(
  L: Loaded,
  domains: Domain[],
  models: OutputModel[],
  records: string[][],
): { divs: FieldDivergence[][]; legacy: string[]; modern: string[]; error?: string } {
  const delim = L.contract.delimiter;
  const res = runBoth(L.legacyBin, L.modernRun, records.map((r) => r.join(delim)), L.contract.dir);
  const divs = records.map((fields, i) =>
    res.legacy[i] === res.modern[i] ? [] : classifyRecord(models, res.legacy[i], res.modern[i], delim),
  );

  // Out-of-range inputs: the legacy program never saw the value it was given,
  // only what its field could hold. Re-run the modern code on *that* value.
  // Any output that now agrees was caused by the input truncation; any that
  // still differs has its own, independent cause — classified against the
  // counterfactual so the input doesn't smear into every finding.
  const suspects = records
    .map((fields, i) => ({ i, bad: divs[i].length ? classifyInputs(domains, fields) : [] }))
    .filter((x) => x.bad.length);
  if (suspects.length) {
    const cf = runModern(
      L.modernRun,
      suspects.map(({ i }) => records[i].map((f, k) => asStored(domains[k], f)).join(delim)),
      L.contract.dir,
    );
    suspects.forEach(({ i, bad }, j) => {
      const remaining = res.legacy[i] === cf[j] ? [] : classifyRecord(models, res.legacy[i], cf[j], delim);
      const causedByInput = divs[i].some((d) => !remaining.some((r) => r.field === d.field));
      divs[i] = [
        ...(causedByInput ? bad.map((b) => ({ ...b, legacy: res.legacy[i], modern: res.modern[i] })) : []),
        ...remaining.map((r) => ({ ...r, modern: r.modern })),
      ];
    });
  }
  return { divs, legacy: res.legacy, modern: res.modern, error: res.modernError ?? res.legacyError };
}

/* ---- shrinking ------------------------------------------------------ */

function complexity(domains: Domain[], fields: string[]): number {
  return fields.reduce((sum, f, i) => {
    const d = domains[i];
    if (d.spec.kind === "alphanumeric") return sum + Math.max(0, d.values.indexOf(f));
    const digits = f.replace(/[^1-9]/g, "").length;
    return sum + digits + (f.startsWith("-") ? 1 : 0) + (/\.\d*[1-9]/.test(f) ? 1 : 0);
  }, 0);
}

function candidates(domains: Domain[], fields: string[]): string[][] {
  const out: string[][] = [];
  domains.forEach((d, i) => {
    const set = (v: string) => {
      if (v !== fields[i]) out.push(fields.map((f, j) => (j === i ? v : f)));
    };
    if (d.spec.kind === "alphanumeric") {
      for (const v of d.values) set(v);
      return;
    }
    const v = Number(fields[i]);
    const s = d.spec.scale;
    const u = unit(d.spec);
    set(formatNumber(0, s));
    set(formatNumber(Math.sign(v) * u, s));
    set(formatNumber(Math.trunc(v), s));
    set(formatNumber(Math.trunc(v / 10), s));
    set(formatNumber(Math.abs(v), s));
    if (v !== 0) {
      const p = 10 ** Math.floor(Math.log10(Math.abs(v)));
      set(formatNumber(Math.sign(v) * p, s));
      set(formatNumber(Math.sign(v) * Math.round(Math.abs(v) / p) * p, s));
    }
    if (Math.abs(v) > maxMagnitude(d.spec)) set(formatNumber(Math.sign(v) * (maxMagnitude(d.spec) + u), s));
  });
  return out;
}

function shrinkAll(
  L: Loaded,
  domains: Domain[],
  models: OutputModel[],
  targets: Map<string, string[]>,
): Map<string, Example & { shrinkRounds: number }> {
  const best = new Map([...targets].map(([k, f]) => [k, { fields: f, rounds: 0, legacy: "", modern: "" }]));
  const active = new Set(targets.keys());

  for (let round = 0; round < 25 && active.size; round++) {
    const batch: Array<{ key: string; fields: string[] }> = [];
    for (const key of active) {
      for (const c of candidates(domains, best.get(key)!.fields)) batch.push({ key, fields: c });
    }
    if (!batch.length) break;
    const { divs, legacy, modern } = analyze(L, domains, models, batch.map((b) => b.fields));

    const improved = new Set<string>();
    batch.forEach((b, i) => {
      if (!divs[i].some((d) => keyOf(d) === b.key)) return;
      const cur = best.get(b.key)!;
      if (complexity(domains, b.fields) < complexity(domains, cur.fields)) {
        best.set(b.key, { fields: b.fields, rounds: round + 1, legacy: legacy[i], modern: modern[i] });
        improved.add(b.key);
      }
    });
    for (const k of [...active]) if (!improved.has(k)) active.delete(k);
  }

  // Final confirmation run so every minimal example carries its real outputs.
  const keys = [...best.keys()];
  const confirm = analyze(L, domains, models, keys.map((k) => best.get(k)!.fields));
  const out = new Map<string, Example & { shrinkRounds: number }>();
  keys.forEach((k, i) => {
    const b = best.get(k)!;
    out.set(k, {
      input: b.fields.join(L.contract.delimiter),
      legacy: confirm.legacy[i],
      modern: confirm.modern[i],
      shrinkRounds: b.rounds,
    });
  });
  return out;
}

/* ---- the check ------------------------------------------------------ */

export function check(dir: string, opts: CheckOptions = {}): Report {
  const n = opts.n ?? 20000;
  const seed = opts.seed ?? 1;
  const started = performance.now();

  const L = prepare(dir);
  const domains = buildDomains(L.program, L.contract.inputs);
  const models = modelOutputs(L.program, L.contract.outputs);
  const inputs = generate(domains, n, seed);

  const t0 = performance.now();
  const { divs, legacy, modern, error } = analyze(L, domains, models, inputs.map((g) => g.fields));
  const runMs = performance.now() - t0;

  const strategies: Report["strategies"] = {
    boundary: { inputs: 0, divergent: 0, firstFindAt: null },
    harvested: { inputs: 0, divergent: 0, firstFindAt: null },
    random: { inputs: 0, divergent: 0, firstFindAt: null },
  };

  const agg = new Map<string, { d: FieldDivergence; count: number; first: number; byStrategy: Record<Strategy, number>; fields: string[] }>();
  let divergentInputs = 0;

  inputs.forEach((g, i) => {
    const st = strategies[g.strategy];
    st.inputs++;
    if (!divs[i].length) return;
    divergentInputs++;
    st.divergent++;
    st.firstFindAt ??= st.inputs;
    for (const d of divs[i]) {
      const key = keyOf(d);
      let a = agg.get(key);
      if (!a) {
        a = { d, count: 0, first: i + 1, byStrategy: { boundary: 0, harvested: 0, random: 0 }, fields: g.fields };
        agg.set(key, a);
      }
      a.count++;
      a.byStrategy[g.strategy]++;
    }
  });

  const minimal = shrinkAll(L, domains, models, new Map([...agg].map(([k, a]) => [k, a.fields])));
  const ledger = readLedger(L.contract.dir, L.contract.name);

  const findings: Finding[] = [...agg].map(([key, a]) => {
    const m = minimal.get(key)!;
    const [ml, mm] = [m.legacy.split(L.contract.delimiter), m.modern.split(L.contract.delimiter)];
    const idx = L.contract.outputs.indexOf(a.d.field);
    const shownL = idx >= 0 ? ml[idx]?.trim() ?? m.legacy : m.legacy;
    const shownM = idx >= 0 ? mm[idx]?.trim() ?? m.modern : m.input.split(L.contract.delimiter)[L.contract.inputs.findIndex((x) => x.name === a.d.field)];
    const decision = ledger.entries[key];
    const derived = a.d.kind === "propagated";
    return {
      key,
      field: a.d.field,
      kind: a.d.kind,
      derived,
      from: a.d.from,
      count: a.count,
      share: a.count / n,
      firstSeenAt: a.first,
      byStrategy: a.byStrategy,
      example: { input: a.fields.join(L.contract.delimiter), legacy: legacy[a.first - 1], modern: modern[a.first - 1] },
      minimal: m,
      explanation: explain(L.program, a.d.field, a.d.kind, shownL, shownM, a.d.from),
      decision,
      status: decision?.decision === "accept" ? "accepted" : decision?.decision === "preserve" ? "preserve" : "open",
    };
  });

  const order: Record<string, number> = { crash: 0, "sign-loss": 1, "sign-loss+truncation": 2, "high-order-truncation": 3, rounding: 4, value: 5, format: 6, "input-overflow": 7, "input-sign-loss": 8, propagated: 9 };
  findings.sort((x, y) => Number(x.derived) - Number(y.derived) || (order[x.kind] ?? 99) - (order[y.kind] ?? 99) || y.count - x.count);

  const sample = [
    ...findings.map((f) => f.minimal.input),
    ...inputs.slice(0, 3000).map((g) => g.fields.join(L.contract.delimiter)),
  ];
  const coverage = measureCoverage(L.program, L.tracedBin, sample, L.workDir);

  const roots = findings.filter((f) => !f.derived);
  const blocking = roots.filter((f) => f.status !== "accepted");
  const verdict: Verdict = !findings.length ? "EQUIVALENT" : !blocking.length ? "EQUIVALENT_WITH_DECLARED_CHANGES" : "DIVERGENT";

  const live = new Set(findings.map((f) => f.key));
  const resolvedDecisions = Object.entries(ledger.entries)
    .filter(([k]) => !live.has(k))
    .map(([key, e]) => ({ key, ...e }));

  const durationMs = performance.now() - started;
  const summary =
    verdict === "EQUIVALENT"
      ? `No divergence in ${n.toLocaleString("en-US")} inputs. ${coverage.statements.hit}/${coverage.statements.total} statements and ${coverage.decisions.bothWays}/${coverage.decisions.total} decisions exercised both ways.`
      : verdict === "EQUIVALENT_WITH_DECLARED_CHANGES"
        ? `${roots.length} accepted change${roots.length === 1 ? "" : "s"}, recorded in the ledger. Nothing undeclared in ${n.toLocaleString("en-US")} inputs.`
        : `${blocking.length} undecided or unfixed behavioural difference${blocking.length === 1 ? "" : "s"} across ${divergentInputs.toLocaleString("en-US")} of ${n.toLocaleString("en-US")} inputs.`;

  const report: Report = {
    program: L.program.programId,
    source: L.contract.legacy.source,
    modernLabel: L.contract.modern.label ?? L.contract.modern.run,
    dialect: L.contract.legacy.dialect,
    inputs: L.contract.inputs.map((i) => i.name),
    outputs: L.contract.outputs,
    generatedAt: new Date().toISOString(),
    seed,
    inputsRun: n,
    durationMs: Math.round(durationMs),
    throughput: Math.round(n / (runMs / 1000)),
    domains: domains.map((d) => ({
      name: d.name,
      pic: d.spec.raw,
      description: describePic(d.spec),
      harvested: d.harvested,
      values: d.values,
    })),
    strategies,
    divergentInputs,
    findings,
    resolvedDecisions,
    coverage,
    verdict,
    summary: error && divergentInputs === n ? `${summary} (modern program error: ${error})` : summary,
  };

  writeFileSync(join(L.workDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  return report;
}
