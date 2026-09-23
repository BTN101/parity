"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Finding, Report, Scenario, Strategy } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

const KIND: Record<string, { label: string; tone: "red" | "amber" | "muted" }> = {
  "sign-loss": { label: "sign lost", tone: "red" },
  "sign-loss+truncation": { label: "sign + digits lost", tone: "red" },
  "high-order-truncation": { label: "digits truncated", tone: "red" },
  rounding: { label: "rounding", tone: "amber" },
  value: { label: "logic", tone: "red" },
  propagated: { label: "follows upstream", tone: "muted" },
  "input-overflow": { label: "input too large", tone: "amber" },
  "input-sign-loss": { label: "input sign lost", tone: "amber" },
  format: { label: "text format", tone: "muted" },
  crash: { label: "crash", tone: "red" },
};

const VERDICT = {
  DIVERGENT: { word: "Divergent", color: "var(--red)", bg: "var(--red-bg)", line: "The translation does not behave like the original." },
  EQUIVALENT_WITH_DECLARED_CHANGES: {
    word: "Equivalent, with declared changes",
    color: "var(--green)",
    bg: "var(--green-bg)",
    line: "The only differences left are ones a person chose and signed.",
  },
  EQUIVALENT: { word: "Equivalent", color: "var(--green)", bg: "var(--green-bg)", line: "No behavioural difference found." },
} as const;

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (x: number) => (x >= 0.1 ? `${Math.round(x * 100)}%` : `${(x * 100).toFixed(1)}%`);

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */

function Chip({ tone, children }: { tone: "red" | "amber" | "muted" | "green" | "blue"; children: React.ReactNode }) {
  const map = {
    red: ["var(--red)", "var(--red-bg)"],
    amber: ["var(--amber)", "var(--amber-bg)"],
    green: ["var(--green)", "var(--green-bg)"],
    blue: ["var(--blue)", "#edf5ff"],
    muted: ["var(--muted)", "#ebeae6"],
  }[tone];
  return (
    <span className="mono text-[10.5px] uppercase tracking-[0.06em] px-1.5 py-[2px] rounded-sm whitespace-nowrap" style={{ color: map[0], background: map[1] }}>
      {children}
    </span>
  );
}

function Status({ f }: { f: Finding }) {
  if (f.derived) return <Chip tone="muted">derived</Chip>;
  if (f.status === "accepted") return <Chip tone="green">accepted</Chip>;
  if (f.status === "preserve") return <Chip tone="red">preserve · unfixed</Chip>;
  return <Chip tone="amber">needs decision</Chip>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="mono tabular text-[22px] leading-none tracking-tight">{value}</div>
      <div className="text-[11.5px] mt-1.5" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}

function StrategyBar({ by }: { by: Record<Strategy, number> }) {
  const total = by.boundary + by.harvested + by.random || 1;
  const parts: Array<[Strategy, string, string]> = [
    ["boundary", "#0f62fe", "edges of the PICTURE"],
    ["harvested", "#8a3ffc", "edges from the code's own comparisons"],
    ["random", "#a8a8a8", "random across the range"],
  ];
  return (
    <div>
      <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: "var(--line-2)" }}>
        {parts.map(([k, c]) => (
          <div key={k} style={{ width: `${(by[k] / total) * 100}%`, background: c }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
        {parts.map(([k, c, desc]) => (
          <span key={k} className="inline-flex items-center gap-1.5" title={desc}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
            {k} <span className="mono tabular">{fmt(by[k])}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The counterexample                                                  */
/* ------------------------------------------------------------------ */

function Counterexample({ r, f }: { r: Report; f: Finding }) {
  const ins = f.minimal.input.split(",");
  const L = f.minimal.legacy.split(",");
  const M = f.minimal.modern.split(",");

  return (
    <div className="rounded-md border overflow-hidden" style={{ borderColor: "var(--line)" }}>
      <div className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--line)", background: "#faf9f7" }}>
        <div className="text-[11px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--muted)" }}>
          Simplest input that shows it · shrunk in {f.minimal.shrinkRounds} round{f.minimal.shrinkRounds === 1 ? "" : "s"}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {r.inputs.map((name, i) => (
            <span key={name} className="mono text-[13px]">
              <span style={{ color: "var(--muted)" }}>{name} </span>
              <span className={name === f.field ? "font-semibold" : ""} style={{ color: name === f.field ? "var(--amber)" : "var(--ink)" }}>
                {ins[i]}
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
              <th className="font-normal px-3.5 py-2">Output</th>
              <th className="font-normal px-3.5 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--phosphor-dim)" }} /> Legacy COBOL
                </span>
              </th>
              <th className="font-normal px-3.5 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--blue)" }} /> Modern Java
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {r.outputs.map((name, i) => {
              const l = (L[i] ?? "").trim();
              const m = (M[i] ?? "").trim();
              const differs = l !== m;
              const focus = name === f.field;
              return (
                <tr key={name} className="border-t" style={{ borderColor: "var(--line-2)", background: focus ? "var(--red-bg)" : undefined }}>
                  <td className="mono text-[12.5px] px-3.5 py-2" style={{ color: "var(--ink-2)" }}>
                    {name}
                  </td>
                  <td className="mono tabular text-[14px] px-3.5 py-2">{l}</td>
                  <td className="mono tabular text-[14px] px-3.5 py-2" style={{ color: differs ? "var(--red)" : undefined, fontWeight: differs ? 600 : 400 }}>
                    {m}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The legacy source, on a green screen                                */
/* ------------------------------------------------------------------ */

function Source({ src, r, f }: { src: string; r: Report; f: Finding | null }) {
  const lines = src.split("\n");
  const refs = new Map((f?.explanation.refs ?? []).map((x) => [x.line, x.role]));
  const stmts = new Set(r.coverage.statementLines);
  const missed = new Set(r.coverage.missedLines);
  const oneWay = new Set(r.coverage.decisions.oneWay);
  const scroller = useRef<HTMLDivElement>(null);
  const firstRef = Math.min(...(f?.explanation.refs ?? []).map((x) => x.line));

  // Bring the lines this finding is about into view — inside the panel only,
  // never moving the page.
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(`[data-line="${firstRef}"]`);
    if (box && el) box.scrollTo({ top: Math.max(0, el.offsetTop - 60), behavior: "smooth" });
  }, [firstRef, r]);

  return (
    <div className="crt rounded-md overflow-hidden relative">
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "#123a22" }}>
        <span className="mono text-[11.5px] tracking-[0.08em]" style={{ color: "var(--phosphor-dim)" }}>
          {r.source.toUpperCase()} · GNUCOBOL -STD={r.dialect.toUpperCase()}
        </span>
        <span className="mono text-[11px]" style={{ color: "var(--phosphor-dim)" }}>
          ● executed ○ never reached
        </span>
      </div>
      <div ref={scroller} className="crt-scan overflow-auto max-h-[520px] relative">
        <pre className="mono text-[12.5px] leading-[1.6] py-3">
          {lines.map((text, i) => {
            const n = i + 1;
            const role = refs.get(n);
            const isStmt = stmts.has(n);
            return (
              <div
                key={n}
                data-line={n}
                className="flex pr-4"
                style={{
                  background: role === "declaration" ? "rgba(255, 196, 0, 0.14)" : role === "write" ? "rgba(92, 255, 138, 0.10)" : undefined,
                  boxShadow: role ? `inset 3px 0 0 ${role === "declaration" ? "#ffc400" : "var(--phosphor)"}` : undefined,
                }}
              >
                <span className="select-none w-12 text-right pr-3 shrink-0" style={{ color: "#1f5a33" }}>
                  {n}
                </span>
                <span className="select-none w-4 shrink-0" style={{ color: missed.has(n) ? "#ff6b6b" : "var(--phosphor-dim)" }}>
                  {isStmt ? (missed.has(n) ? "○" : oneWay.has(n) ? "◐" : "●") : ""}
                </span>
                <span style={{ color: role === "declaration" ? "#ffe08a" : role ? "var(--phosphor-hi)" : undefined }}>{text || " "}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

function Detail({ r, f }: { r: Report; f: Finding }) {
  const k = KIND[f.kind] ?? { label: f.kind, tone: "muted" as const };
  return (
    <div className="fade-in space-y-5" key={f.key}>
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <Chip tone={k.tone}>{k.label}</Chip>
          <Status f={f} />
          <span className="mono text-[11.5px]" style={{ color: "var(--muted)" }}>
            {f.key}
          </span>
        </div>
        <h2 className="text-[22px] leading-snug font-semibold tracking-tight">{f.explanation.headline}</h2>
        <p className="text-[14.5px] leading-relaxed mt-2" style={{ color: "var(--ink-2)" }}>
          {f.explanation.detail}
        </p>
      </div>

      <Counterexample r={r} f={f} />

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ color: "var(--muted)" }}>
            Reach · {fmt(f.count)} of {fmt(r.inputsRun)} inputs ({pct(f.share)})
          </div>
          <StrategyBar by={f.byStrategy} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ color: "var(--muted)" }}>
            If preserved
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {f.explanation.preserveHint}
          </p>
        </div>
      </div>

      {f.decision ? (
        <div className="rounded-md border-l-[3px] px-4 py-3" style={{ borderColor: f.decision.decision === "accept" ? "var(--green)" : "var(--blue)", background: "var(--panel)" }}>
          <div className="text-[11px] uppercase tracking-[0.08em] mb-1" style={{ color: "var(--muted)" }}>
            Ledger · {f.decision.decision === "accept" ? "accepted as intentional change" : "must preserve legacy behaviour"}
          </div>
          <p className="text-[14px] leading-relaxed">“{f.decision.rationale}”</p>
          <div className="text-[12px] mt-1.5" style={{ color: "var(--muted)" }}>
            {f.decision.decidedBy} · {new Date(f.decision.decidedAt).toISOString().slice(0, 10)}
          </div>
        </div>
      ) : !f.derived ? (
        <div className="rounded-md border border-dashed px-4 py-3 text-[13.5px] leading-relaxed" style={{ borderColor: "var(--amber)", color: "var(--ink-2)", background: "var(--amber-bg)" }}>
          <span className="font-semibold">A person decides this, not the agent.</span> Is this a legacy defect to correct at cutover, or behaviour
          downstream systems rely on? Bob asks; the answer and the reason go into the ledger.
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Console({ scenarios }: { scenarios: Scenario[] }) {
  const programs = [...new Set(scenarios.map((s) => s.program))];
  const [program, setProgram] = useState(programs[0]);
  const [stage, setStage] = useState<"first-draft" | "after-repair">("first-draft");
  const sc = scenarios.find((s) => s.program === program && s.stage === stage)!;
  const r = sc.report;

  const roots = useMemo(() => r.findings.filter((f) => !f.derived), [r]);
  const derived = useMemo(() => r.findings.filter((f) => f.derived), [r]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = r.findings.find((f) => f.key === selectedKey) ?? roots[0] ?? null;
  const v = VERDICT[r.verdict];

  const choose = (p: string, s: "first-draft" | "after-repair") => {
    setProgram(p);
    setStage(s);
    setSelectedKey(null);
  };

  return (
    <div className="min-h-screen">
      {/* header */}
      <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
        <div className="max-w-[1320px] mx-auto px-4 sm:px-8 py-4 flex items-center gap-x-8 gap-y-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <span className="text-[20px] font-semibold tracking-tight">Parity</span>
            <span className="text-[13px] hidden sm:inline" style={{ color: "var(--muted)" }}>
              behavioural equivalence for AI-modernised COBOL
            </span>
          </div>
          <nav className="flex items-center gap-1 ml-auto">
            {programs.map((p) => (
              <button
                key={p}
                onClick={() => choose(p, stage)}
                className="mono text-[12.5px] px-3 py-1.5 rounded-sm transition-colors"
                style={{ background: p === program ? "var(--ink)" : "transparent", color: p === program ? "#fff" : "var(--ink-2)" }}
              >
                {p}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-[1320px] mx-auto px-4 sm:px-8 py-7 space-y-7">
        {/* the loop */}
        <div className="flex items-stretch gap-2 flex-wrap">
          {(["first-draft", "after-repair"] as const).map((s, i) => {
            const target = scenarios.find((x) => x.program === program && x.stage === s)!;
            const active = s === stage;
            return (
              <button
                key={s}
                onClick={() => choose(program, s)}
                className="flex-1 min-w-[220px] text-left rounded-md border px-4 py-3 transition-colors"
                style={{ borderColor: active ? "var(--ink)" : "var(--line)", background: active ? "var(--panel)" : "transparent" }}
              >
                <div className="flex items-center gap-2">
                  <span className="mono text-[11px] w-5 h-5 rounded-full grid place-items-center" style={{ background: active ? "var(--ink)" : "var(--line)", color: active ? "#fff" : "var(--ink-2)" }}>
                    {i + 1}
                  </span>
                  <span className="text-[14px] font-medium">{target.stageLabel}</span>
                </div>
                <div className="text-[12.5px] mt-1 pl-7" style={{ color: VERDICT[target.report.verdict].color }}>
                  {VERDICT[target.report.verdict].word}
                  <span style={{ color: "var(--muted)" }}> · {target.report.modernLabel}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* verdict */}
        <section className="rounded-md border px-5 sm:px-7 py-6" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
          <div className="flex items-start gap-x-10 gap-y-6 flex-wrap">
            <div className="min-w-0 flex-1 basis-[420px]">
              <div className="inline-block mono text-[11px] uppercase tracking-[0.1em] px-2 py-1 rounded-sm mb-3" style={{ color: v.color, background: v.bg }}>
                Verdict
              </div>
              <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight" style={{ color: v.color }}>
                {v.word}
              </h1>
              <p className="text-[15px] mt-2.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {v.line} {r.summary}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-5 basis-[520px] grow">
              <Stat value={fmt(r.inputsRun)} label="inputs, both programs" />
              <Stat value={fmt(r.throughput)} label="input pairs per second" />
              <Stat value={`${r.coverage.statements.hit}/${r.coverage.statements.total}`} label="COBOL statements reached" />
              <Stat value={`${r.coverage.decisions.bothWays}/${r.coverage.decisions.total}`} label="IFs seen both ways" />
            </div>
          </div>
        </section>

        {/* findings */}
        {roots.length > 0 && selected ? (
          <section className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6 items-start">
            <div className="rounded-md border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
              <div className="px-4 py-3 border-b flex items-baseline justify-between" style={{ borderColor: "var(--line)" }}>
                <span className="text-[13px] font-medium">Behavioural differences</span>
                <span className="mono text-[12px]" style={{ color: "var(--muted)" }}>
                  {roots.length}
                  {derived.length ? ` + ${derived.length} derived` : ""}
                </span>
              </div>
              <ul>
                {[...roots, ...derived].map((f) => {
                  const k = KIND[f.kind] ?? { label: f.kind, tone: "muted" as const };
                  const active = f.key === selected.key;
                  return (
                    <li key={f.key}>
                      <button
                        onClick={() => setSelectedKey(f.key)}
                        className="w-full text-left px-4 py-3 border-b transition-colors"
                        style={{
                          borderColor: "var(--line-2)",
                          background: active ? "#f6f5f2" : "transparent",
                          boxShadow: active ? "inset 3px 0 0 var(--ink)" : undefined,
                          opacity: f.derived ? 0.65 : 1,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="mono text-[13px] font-medium">{f.field}</span>
                          <Chip tone={k.tone}>{k.label}</Chip>
                          <span className="ml-auto">
                            <Status f={f} />
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 mt-2">
                          <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "var(--line-2)" }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, f.share * 100)}%`, background: k.tone === "red" ? "var(--red)" : k.tone === "amber" ? "#d2a106" : "#a8a8a8" }} />
                          </div>
                          <span className="mono tabular text-[11.5px] w-11 text-right" style={{ color: "var(--muted)" }}>
                            {pct(f.share)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-md border px-5 sm:px-6 py-6" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
              <Detail r={r} f={selected} />
            </div>
          </section>
        ) : (
          <section className="rounded-md border px-6 py-6" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <h2 className="text-[18px] font-semibold">No behavioural difference in {fmt(r.inputsRun)} inputs.</h2>
            <p className="text-[14px] mt-1.5" style={{ color: "var(--ink-2)" }}>
              Every finding from the first translation was decided and fixed. The ledger below is the audit trail.
            </p>
          </section>
        )}

        {/* ledger */}
        {(r.resolvedDecisions.length > 0 || r.findings.some((f) => f.decision)) && (
          <section className="rounded-md border" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <div className="px-5 py-3 border-b flex items-baseline gap-3" style={{ borderColor: "var(--line)" }}>
              <span className="text-[13px] font-medium">Decision ledger</span>
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                committed next to the code · the migration&apos;s audit trail
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <tbody>
                  {[
                    ...r.findings.filter((f) => f.decision).map((f) => ({ key: f.key, ...f.decision!, state: "in effect" })),
                    ...r.resolvedDecisions.map((d) => ({ ...d, state: "fixed · no longer observed" })),
                  ].map((d) => (
                    <tr key={d.key} className="border-b last:border-0 align-top" style={{ borderColor: "var(--line-2)" }}>
                      <td className="mono text-[12px] px-5 py-2.5 whitespace-nowrap">{d.key}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Chip tone={d.decision === "accept" ? "green" : "blue"}>{d.decision}</Chip>
                      </td>
                      <td className="px-3 py-2.5 min-w-[260px]" style={{ color: "var(--ink-2)" }}>
                        {d.rationale}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-[12px]" style={{ color: "var(--muted)" }}>
                        {d.decidedBy}
                      </td>
                      <td className="px-5 py-2.5 whitespace-nowrap text-[12px]" style={{ color: "var(--muted)" }}>
                        {d.state}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* source + domain */}
        <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-6 items-start">
          <Source src={sc.source} r={r} f={selected} />
          <div className="rounded-md border px-5 py-5" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <div className="text-[13px] font-medium">What Parity aimed at</div>
            <p className="text-[12.5px] mt-1 mb-4 leading-relaxed" style={{ color: "var(--muted)" }}>
              Read from the COBOL itself: each input&apos;s PICTURE, and every literal the code compares it against.
            </p>
            <ul className="space-y-3.5">
              {r.domains.map((d) => (
                <li key={d.name}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="mono text-[13px] font-medium">{d.name}</span>
                    <span className="mono text-[12px]" style={{ color: "var(--blue)" }}>
                      PIC {d.pic}
                    </span>
                  </div>
                  <div className="text-[12.5px] mt-0.5" style={{ color: "var(--ink-2)" }}>
                    {d.description}
                  </div>
                  {d.harvested.length > 0 && (
                    <div className="mono text-[11.5px] mt-1" style={{ color: "#8a3ffc" }}>
                      edges from code: {d.harvested.join(" · ")}
                    </div>
                  )}
                  {d.values.length > 0 && (
                    <div className="mono text-[11.5px] mt-1" style={{ color: "var(--muted)" }}>
                      values: {d.values.join(" · ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t mt-5 pt-4 text-[12px] leading-relaxed" style={{ borderColor: "var(--line-2)", color: "var(--muted)" }}>
              First divergence found by: boundary #{r.strategies.boundary.firstFindAt ?? "—"} · harvested #{r.strategies.harvested.firstFindAt ?? "—"} · random #
              {r.strategies.random.firstFindAt ?? "—"}
            </div>
          </div>
        </section>

        <footer className="border-t pt-5 pb-10 text-[12.5px] leading-relaxed max-w-[860px]" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
          <span className="font-medium" style={{ color: "var(--ink-2)" }}>
            What this does not prove.
          </span>{" "}
          Parity is differential testing, not formal proof: the programs agree on every input tried, and the inputs are aimed at the
          places COBOL and modern arithmetic are known to disagree. The legacy leg runs under GnuCOBOL in IBM compatibility mode, which
          approximates but is not IBM Enterprise COBOL on z/OS. Every report here is a real run, seed {r.seed}, reproducible from the repository.
        </footer>
      </main>
    </div>
  );
}
