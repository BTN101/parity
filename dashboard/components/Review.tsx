"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Finding, LedgerEntry, Report } from "@/lib/types";
import { KIND, cells, day, decisionOf, fmt, loadReviewer, pct, saveReviewer, stateOf, type Decision, type LocalDecisions, type ReviewState } from "@/lib/review";
import { Card, CodeLines, Label, StatePill } from "./ui";

type Filter = "todo" | "all" | "decided";

export default function Review({
  r,
  local,
  onDecide,
  onUndo,
}: {
  r: Report;
  local: LocalDecisions;
  onDecide: (key: string, entry: LedgerEntry) => void;
  onUndo: (key: string) => void;
}) {
  const roots = r.findings.filter((f) => !f.derived);
  const derived = r.findings.filter((f) => f.derived);
  const openCount = roots.filter((f) => stateOf(f, local) === "open").length;

  const [filter, setFilter] = useState<Filter>(openCount ? "todo" : "all");
  const [showDerived, setShowDerived] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<string | null>(null);
  const detailTop = useRef<HTMLDivElement>(null);

  const record = (key: string, entry: LedgerEntry) => {
    const f = r.findings.find((x) => x.key === key);
    const left = roots.filter((x) => x.key !== key && stateOf(x, local) === "open").length;
    setRecorded(`Recorded “${entry.decision === "preserve" ? "Keep the old behaviour" : "Accept the change"}” for ${f?.explanation.headline ?? key}. ${left ? `${left} left to decide.` : "Nothing left to decide."}`);
    onDecide(key, entry);
    setSelectedKey(null);
    const top = detailTop.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) detailTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    setFilter(roots.some((f) => stateOf(f, local) === "open") ? "todo" : "all");
    setSelectedKey(null);
    setRecorded(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  const visible = useMemo(() => {
    const byFilter = roots.filter((f) => {
      const s = stateOf(f, local);
      return filter === "all" || (filter === "todo" ? s === "open" : s !== "open");
    });
    return showDerived ? [...byFilter, ...derived] : byFilter;
  }, [roots, derived, local, filter, showDerived]);

  const selected = r.findings.find((f) => f.key === selectedKey) ?? visible[0] ?? roots[0] ?? null;

  if (!r.findings.length) {
    return (
      <Card className="px-6 py-8">
        <h2 className="text-[20px] font-semibold">No behavioural differences in {fmt(r.inputsRun)} test cases.</h2>
        <p className="text-[14.5px] mt-2 leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Every difference from the earlier check was decided and fixed. The decisions are listed on the certificate.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-5 items-start">
      {/* list */}
      <Card className="overflow-hidden">
        <div className="flex gap-1 p-2 border-b" style={{ borderColor: "var(--line)" }}>
          {(
            [
              ["todo", `To decide (${openCount})`],
              ["decided", `Decided (${roots.length - openCount})`],
              ["all", `All (${roots.length})`],
            ] as Array<[Filter, string]>
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="text-[13px] px-3 py-1.5 rounded-md transition-colors"
              style={{ background: filter === k ? "var(--ink)" : "transparent", color: filter === k ? "#fff" : "var(--ink-2)" }}
            >
              {label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-[14px]" style={{ color: "var(--muted)" }}>
            {filter === "todo" ? "Nothing left to decide." : "Nothing here yet."}
          </p>
        ) : (
          <ul>
            {visible.map((f) => (
              <Row
                key={f.key}
                f={f}
                state={stateOf(f, local)}
                active={f.key === selected?.key}
                onClick={() => {
                  setSelectedKey(f.key);
                  setRecorded(null);
                }}
              />
            ))}
          </ul>
        )}
        {derived.length > 0 && (
          <button onClick={() => setShowDerived((x) => !x)} className="w-full text-left text-[12.5px] px-4 py-2.5 border-t" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
            {showDerived ? "Hide" : "Show"} {derived.length} follow-on difference{derived.length === 1 ? "" : "s"} (caused by the ones above, no decision needed)
          </button>
        )}
      </Card>

      {/* detail */}
      <div ref={detailTop} className="space-y-3 scroll-mt-4">
        {recorded && (
          <div className="rounded-md px-4 py-3 text-[14px] fade-in" style={{ background: "var(--green-bg)", color: "var(--ink)" }}>
            {recorded}
          </div>
        )}
        {selected && <Detail key={selected.key} r={r} f={selected} state={stateOf(selected, local)} entry={decisionOf(selected, local)} isLocal={!!local[selected.key]} onDecide={record} onUndo={onUndo} />}
      </div>
    </div>
  );
}

function Row({ f, state, active, onClick }: { f: Finding; state: ReviewState; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full text-left px-4 py-3.5 border-b transition-colors"
        style={{ borderColor: "var(--line-2)", background: active ? "#f6f5f2" : "transparent", boxShadow: active ? "inset 3px 0 0 var(--ink)" : undefined }}
      >
        <div className="text-[14px] font-medium leading-snug">{f.explanation.headline}</div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatePill state={state} />
          <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>
            {KIND[f.kind] ?? f.kind} · {pct(f.share)} of cases
          </span>
        </div>
      </button>
    </li>
  );
}

function Detail({
  r,
  f,
  state,
  entry,
  isLocal,
  onDecide,
  onUndo,
}: {
  r: Report;
  f: Finding;
  state: ReviewState;
  entry?: LedgerEntry;
  isLocal: boolean;
  onDecide: (key: string, entry: LedgerEntry) => void;
  onUndo: (key: string) => void;
}) {
  const ins = cells(f.minimal.input);
  const L = cells(f.minimal.legacy);
  const M = cells(f.minimal.modern);
  const refs = [...f.explanation.refs].sort((a, b) => a.line - b.line);

  return (
    <Card className="px-5 sm:px-7 py-6 fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        <StatePill state={state} />
        <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>
          {KIND[f.kind] ?? f.kind}
        </span>
      </div>
      <h2 className="text-[24px] leading-tight font-semibold tracking-tight mt-3">{f.explanation.headline}</h2>
      <p className="text-[15px] leading-relaxed mt-2.5" style={{ color: "var(--ink-2)" }}>
        {f.explanation.detail}
      </p>
      <p className="text-[13.5px] mt-2" style={{ color: "var(--muted)" }}>
        Happens in {fmt(f.count)} of {fmt(r.inputsRun)} test cases ({pct(f.share)}).
        {f.derived && f.from ? ` Caused by: ${f.from}.` : ""}
      </p>

      <div className="mt-6">
        <Label>Simplest example</Label>
        <div className="rounded-md border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          <div className="px-4 py-2.5 border-b flex flex-wrap gap-x-5 gap-y-1" style={{ borderColor: "var(--line)", background: "#faf9f7" }}>
            <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>
              Input
            </span>
            {r.inputs.map((name, i) => (
              <span key={name} className="mono text-[13px]">
                <span style={{ color: "var(--muted)" }}>{name} </span>
                {ins[i]}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                  <th className="font-normal px-4 py-2">Output</th>
                  <th className="font-normal px-4 py-2">Old COBOL system</th>
                  <th className="font-normal px-4 py-2">New Java system</th>
                </tr>
              </thead>
              <tbody>
                {r.outputs.map((name, i) => {
                  const differs = L[i] !== M[i];
                  return (
                    <tr key={name} className="border-t" style={{ borderColor: "var(--line-2)", background: differs ? "var(--red-bg)" : undefined }}>
                      <td className="mono text-[13px] px-4 py-2" style={{ color: "var(--ink-2)" }}>
                        {name}
                      </td>
                      <td className="mono tabular text-[14px] px-4 py-2">{L[i]}</td>
                      <td className="mono tabular text-[14px] px-4 py-2" style={{ color: differs ? "var(--red)" : undefined, fontWeight: differs ? 600 : 400 }}>
                        {M[i]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {refs.length > 0 && (
        <div className="mt-6">
          <Label>Where it comes from in the COBOL</Label>
          <CodeLines lines={refs.map((x) => ({ line: x.line, text: x.text, note: x.role === "declaration" ? "the field" : "stored here" }))} />
        </div>
      )}

      {!f.derived && (
        <div className="mt-7 border-t pt-6" style={{ borderColor: "var(--line)" }}>
          {entry ? (
            <DecisionRecord entry={entry} isLocal={isLocal} onChange={() => onUndo(f.key)} />
          ) : (
            <DecisionForm hint={f.explanation.preserveHint} onSave={(e) => onDecide(f.key, e)} />
          )}
        </div>
      )}
    </Card>
  );
}

function DecisionRecord({ entry, isLocal, onChange }: { entry: LedgerEntry; isLocal: boolean; onChange: () => void }) {
  const keep = entry.decision === "preserve";
  return (
    <div>
      <Label>Decision</Label>
      <div className="rounded-md border-l-[3px] px-4 py-3" style={{ borderColor: keep ? "var(--blue)" : "var(--green)", background: "#faf9f7" }}>
        <div className="text-[15px] font-semibold">{keep ? "Keep the old behaviour" : "Accept the change"}</div>
        <p className="text-[14px] leading-relaxed mt-1">“{entry.rationale}”</p>
        <div className="text-[12.5px] mt-1.5" style={{ color: "var(--muted)" }}>
          {entry.decidedBy} · {day(entry.decidedAt)}
          {isLocal ? " · not exported yet" : ""}
        </div>
      </div>
      {isLocal && (
        <button onClick={onChange} className="text-[13px] mt-3 underline" style={{ color: "var(--ink-2)" }}>
          Change this decision
        </button>
      )}
    </div>
  );
}

function DecisionForm({ hint, onSave }: { hint: string; onSave: (e: LedgerEntry) => void }) {
  const [choice, setChoice] = useState<Decision | null>(null);
  const [why, setWhy] = useState("");
  const [who, setWho] = useState("");
  useEffect(() => setWho(loadReviewer()), []);
  const ready = choice && why.trim() && who.trim();

  const options: Array<[Decision, string, string]> = [
    ["preserve", "Keep the old behaviour", "The Java must reproduce what the COBOL does, exactly. Developers fix the Java."],
    ["accept", "Accept the change", "The new behaviour is intended. It is listed on the certificate as a declared change."],
  ];

  return (
    <div>
      <Label>Your decision</Label>
      <div className="grid sm:grid-cols-2 gap-3">
        {options.map(([k, title, body]) => (
          <button
            key={k}
            onClick={() => setChoice(k)}
            className="text-left rounded-md border px-4 py-3 transition-colors"
            style={{ borderColor: choice === k ? "var(--ink)" : "var(--line)", background: choice === k ? "#f6f5f2" : "transparent", boxShadow: choice === k ? "inset 0 0 0 1px var(--ink)" : undefined }}
          >
            <div className="text-[14.5px] font-semibold">{title}</div>
            <div className="text-[13px] mt-1 leading-snug" style={{ color: "var(--ink-2)" }}>
              {body}
            </div>
          </button>
        ))}
      </div>
      {choice === "preserve" && (
        <p className="text-[13px] mt-3 leading-relaxed" style={{ color: "var(--muted)" }}>
          <span className="font-medium" style={{ color: "var(--ink-2)" }}>
            Fix for developers:{" "}
          </span>
          {hint}
        </p>
      )}
      <label className="block mt-4">
        <span className="text-[13px] font-medium">Reason</span>
        <textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          rows={2}
          placeholder="e.g. Downstream settlement files depend on this value"
          className="mt-1.5 w-full rounded-md border px-3 py-2 text-[14px] outline-none focus:border-[var(--ink)]"
          style={{ borderColor: "var(--line)" }}
        />
      </label>
      <div className="flex items-end gap-3 mt-3 flex-wrap">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-[13px] font-medium">Decided by</span>
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Name and role"
            className="mt-1.5 w-full rounded-md border px-3 py-2 text-[14px] outline-none focus:border-[var(--ink)]"
            style={{ borderColor: "var(--line)" }}
          />
        </label>
        <button
          disabled={!ready}
          onClick={() => {
            saveReviewer(who.trim());
            onSave({ decision: choice!, rationale: why.trim(), decidedBy: who.trim(), decidedAt: new Date().toISOString() });
          }}
          className="text-[14px] font-medium px-5 py-2 rounded-md transition-opacity"
          style={{ background: "var(--ink)", color: "#fff", opacity: ready ? 1 : 0.35 }}
        >
          Record decision
        </button>
      </div>
    </div>
  );
}
