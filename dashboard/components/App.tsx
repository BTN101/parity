"use client";

import { useEffect, useRef, useState } from "react";
import type { LedgerEntry, Report, Scenario } from "@/lib/types";
import { VERDICT, buildLedger, counts, day, download, fmt, loadLocal, saveLocal, type LocalDecisions } from "@/lib/review";
import Review from "./Review";
import Certificate from "./Certificate";
import Technical from "./Technical";
import { Card } from "./ui";

type Tab = "review" | "certificate" | "technical";

export default function App({ samples }: { samples: Scenario[] }) {
  const [scenarios, setScenarios] = useState<Scenario[]>(samples);
  const [id, setId] = useState(samples[0].id);
  const [tab, setTab] = useState<Tab>("review");
  const [local, setLocal] = useState<LocalDecisions>({});
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const sc = scenarios.find((s) => s.id === id) ?? scenarios[0];
  const r = sc.report;
  const programs = [...new Set(scenarios.map((s) => s.program))];
  const runs = scenarios.filter((s) => s.program === sc.program);

  useEffect(() => setLocal(loadLocal(sc)), [sc]);

  const decide = (key: string, entry: LedgerEntry) => {
    const next = { ...local, [key]: entry };
    setLocal(next);
    saveLocal(sc, next);
  };
  const undo = (key: string) => {
    const { [key]: _, ...next } = local;
    setLocal(next);
    saveLocal(sc, next);
  };

  async function openFiles(files: FileList | null) {
    if (!files?.length) return;
    let report: Report | null = null;
    let ledger: { program: string; entries: Record<string, LedgerEntry> } | null = null;
    try {
      for (const file of Array.from(files)) {
        const json = JSON.parse(await file.text());
        if (json && Array.isArray(json.findings) && json.verdict) report = json;
        else if (json && json.entries && json.program) ledger = json;
      }
    } catch {
      setNotice("That file isn't valid JSON. Choose the report.json that `parity check` writes in .parity/.");
      return;
    }
    if (!report) {
      setNotice("No Parity report found. Choose .parity/report.json from the program's folder (you can add parity-ledger.json too).");
      return;
    }
    if (ledger) {
      for (const f of report.findings) if (!f.decision && ledger.entries[f.key]) f.decision = ledger.entries[f.key];
    }
    const next: Scenario = {
      id: `upload-${report.program}-${report.generatedAt}`,
      program: report.program,
      stage: "uploaded",
      stageLabel: `Your run · ${day(report.generatedAt)}`,
      report,
      source: "",
    };
    setScenarios((xs) => [...xs.filter((x) => x.id !== next.id), next]);
    setId(next.id);
    setTab("review");
    setNotice(null);
  }

  const c = counts(r, local);
  const v = VERDICT[r.verdict];
  const unexported = Object.keys(local).length;

  return (
    <div className="min-h-screen">
      <header className="border-b no-print" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-2.5 sm:py-0 sm:h-14 flex items-center gap-x-6 gap-y-2 flex-wrap">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[19px] font-semibold tracking-tight">Parity</span>
            <span className="text-[13px] hidden sm:inline" style={{ color: "var(--muted)" }}>
              COBOL migration review
            </span>
          </div>
          <nav className="flex items-center gap-1 sm:ml-auto order-3 sm:order-none w-full sm:w-auto">
            {programs.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setId(scenarios.find((s) => s.program === p)!.id);
                  setTab("review");
                }}
                className="mono text-[12.5px] px-3 py-1.5 rounded-md"
                style={{ background: p === sc.program ? "var(--ink)" : "transparent", color: p === sc.program ? "#fff" : "var(--ink-2)" }}
              >
                {p}
              </button>
            ))}
          </nav>
          <button onClick={() => fileInput.current?.click()} className="ml-auto sm:ml-0 text-[13px] font-medium px-3 py-1.5 rounded-md border whitespace-nowrap" style={{ borderColor: "var(--line)" }}>
            Open a report
          </button>
          <input ref={fileInput} type="file" accept=".json,application/json" multiple className="hidden" onChange={(e) => openFiles(e.target.files)} />
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-7 space-y-6">
        {notice && (
          <div className="rounded-md px-4 py-3 text-[14px] no-print" style={{ background: "var(--amber-bg)", color: "var(--ink)" }}>
            {notice}
          </div>
        )}

        {/* program + run */}
        <div className="flex items-end justify-between gap-4 flex-wrap no-print">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight">{r.program}</h1>
            <p className="text-[14px] mt-0.5" style={{ color: "var(--muted)" }}>
              {r.source} (COBOL) → {r.modernLabel}
            </p>
          </div>
          {runs.length > 1 && (
            <div className="flex rounded-md border overflow-hidden max-w-full" style={{ borderColor: "var(--line)" }}>
              {runs.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setId(s.id)}
                  className="text-[13px] px-3.5 py-2 text-left"
                  style={{ background: s.id === sc.id ? "var(--panel)" : "transparent", borderLeft: i ? "1px solid var(--line)" : undefined, fontWeight: s.id === sc.id ? 600 : 400 }}
                >
                  <span style={{ color: "var(--muted)" }}>Run {i + 1} · </span>
                  {s.stageLabel}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* status */}
        <Card className="px-5 sm:px-7 py-5 no-print">
          <div className="flex items-center gap-x-10 gap-y-5 flex-wrap">
            <div className="min-w-[260px] flex-1">
              <div className="text-[24px] font-semibold tracking-tight" style={{ color: v.tone === "red" ? "var(--red)" : "var(--green)" }}>
                {v.word}
              </div>
              <p className="text-[14px] mt-1" style={{ color: "var(--ink-2)" }}>
                {v.line} Tested on {fmt(r.inputsRun)} cases, {day(r.generatedAt)}.
              </p>
            </div>
            <Stat n={c.open} label="to decide" color={c.open ? "var(--amber)" : undefined} />
            <Stat n={c.preserve} label="kept, fix pending" color={c.preserve ? "var(--blue)" : undefined} />
            <Stat n={c.accept} label="accepted changes" />
            <Stat text={`${r.coverage.statements.hit}/${r.coverage.statements.total}`} label="COBOL lines tested" />
          </div>
        </Card>

        {/* tabs */}
        <div className="flex items-end gap-x-1 gap-y-2 border-b no-print flex-wrap" style={{ borderColor: "var(--line)" }}>
          {(
            [
              ["review", "Review differences"],
              ["certificate", "Certificate"],
              ["technical", "Technical details"],
            ] as Array<[Tab, string]>
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="text-[14px] px-3 sm:px-3.5 py-2.5 -mb-px border-b-2 whitespace-nowrap"
              style={{ borderColor: tab === k ? "var(--ink)" : "transparent", fontWeight: tab === k ? 600 : 400, color: tab === k ? "var(--ink)" : "var(--ink-2)" }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => download("parity-ledger.json", JSON.stringify(buildLedger(r, local), null, 2) + "\n")}
            className="sm:ml-auto text-[13px] font-medium px-3 py-1.5 rounded-md mb-2 whitespace-nowrap"
            style={{ background: unexported ? "var(--ink)" : "transparent", color: unexported ? "#fff" : "var(--ink-2)", border: unexported ? undefined : "1px solid var(--line)" }}
            title="Download the decisions as parity-ledger.json. Commit it next to the code; Parity reads it on the next check."
          >
            Export decisions{unexported ? ` (${unexported} new)` : ""}
          </button>
        </div>

        {tab === "review" && <Review r={r} local={local} onDecide={decide} onUndo={undo} />}
        {tab === "certificate" && <Certificate r={r} local={local} source={r.source} />}
        {tab === "technical" && <Technical r={r} source={sc.source} />}

        <footer className="pt-4 pb-10 text-[12.5px] leading-relaxed max-w-[820px] no-print" style={{ color: "var(--muted)" }}>
          Decisions you record here stay in this browser until you export them as <span className="mono">parity-ledger.json</span>. Commit that
          file next to the code and Parity uses it on the next check. To review your own program, run{" "}
          <span className="mono">parity check &lt;folder&gt;</span> and open the <span className="mono">.parity/report.json</span> it writes.
        </footer>
      </main>
    </div>
  );
}

function Stat({ n, text, label, color }: { n?: number; text?: string; label: string; color?: string }) {
  return (
    <div>
      <div className="mono tabular text-[26px] leading-none" style={{ color }}>
        {text ?? n}
      </div>
      <div className="text-[12.5px] mt-1.5" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}
