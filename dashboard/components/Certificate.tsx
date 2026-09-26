import type { LedgerEntry, Report } from "@/lib/types";
import { VERDICT, buildLedger, counts, day, fmt, type LocalDecisions } from "@/lib/review";
import { Card, Label } from "./ui";

export default function Certificate({ r, local, source }: { r: Report; local: LocalDecisions; source: string }) {
  const c = counts(r, local);
  const ready = r.verdict !== "DIVERGENT" && c.open === 0 && c.preserve === 0;
  const pendingRerun = Object.keys(local).length > 0;
  const entries = Object.entries(buildLedger(r, local).entries) as Array<[string, LedgerEntry]>;
  const accepted = entries.filter(([, e]) => e.decision === "accept");
  const kept = entries.filter(([, e]) => e.decision === "preserve");
  const v = VERDICT[r.verdict];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <p className="text-[14px] max-w-[640px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {ready
            ? "This run can be signed off. Print it or save it as a PDF for the change board."
            : "Not ready to sign off. It becomes a certificate once every difference is decided, the kept ones are fixed, and Parity is run again."}
        </p>
        <button onClick={() => window.print()} className="text-[14px] font-medium px-4 py-2 rounded-md border" style={{ borderColor: "var(--ink)" }}>
          Print / save as PDF
        </button>
      </div>

      <Card className="px-6 sm:px-10 py-9 print-sheet relative overflow-hidden">
        {!ready && (
          <div className="absolute top-6 right-6 text-[12px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded border" style={{ color: "var(--red)", borderColor: "var(--red)" }}>
            Draft · not certified
          </div>
        )}
        <div className="mono text-[12px] tracking-[0.12em] uppercase" style={{ color: "var(--muted)" }}>
          Parity · behavioural equivalence certificate
        </div>
        <h2 className="text-[28px] font-semibold tracking-tight mt-2">{r.program}</h2>
        <p className="text-[14.5px] mt-1" style={{ color: "var(--ink-2)" }}>
          {source || r.source} (COBOL) compared with {r.modernLabel}
        </p>

        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4 mt-7 text-[14px]">
          <Fact k="Result" v={<span style={{ color: v.tone === "red" ? "var(--red)" : "var(--green)", fontWeight: 600 }}>{v.word}</span>} />
          <Fact k="Run" v={`${day(r.generatedAt)} · seed ${r.seed}`} />
          <Fact k="Test cases" v={`${fmt(r.inputsRun)}, aimed at the COBOL's own field limits and comparisons`} />
          <Fact k="Coverage" v={`${r.coverage.statements.hit} of ${r.coverage.statements.total} COBOL statements run · ${r.coverage.decisions.bothWays} of ${r.coverage.decisions.total} IF branches seen both ways`} />
          <Fact k="Open differences" v={`${c.open} to decide · ${c.preserve} kept and awaiting a fix`} />
          <Fact k="Declared changes" v={`${accepted.length}`} />
        </div>

        <Decisions title="Declared changes (accepted)" rows={accepted} empty="None. The new code reproduces the old behaviour everywhere tested." />
        <Decisions title="Old behaviour kept" rows={kept} empty="None." />

        {pendingRerun && (
          <p className="text-[13px] mt-6 leading-relaxed" style={{ color: "var(--amber)" }}>
            Includes decisions made in this browser that haven&apos;t been exported yet. Export the decisions and run Parity again to confirm them.
          </p>
        )}

        <div className="border-t mt-8 pt-5 text-[12.5px] leading-relaxed" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
          <span className="font-medium" style={{ color: "var(--ink-2)" }}>
            What this certifies.
          </span>{" "}
          Both programs gave the same result on every test case above, apart from the declared changes. It is differential testing, not a
          mathematical proof. The COBOL ran under GnuCOBOL in IBM compatibility mode, which approximates IBM Enterprise COBOL on z/OS. The
          run is reproducible from the repository with the seed shown.
        </div>
      </Card>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px]" style={{ color: "var(--muted)" }}>
        {k}
      </div>
      <div className="mt-0.5">{v}</div>
    </div>
  );
}

function Decisions({ title, rows, empty }: { title: string; rows: Array<[string, LedgerEntry]>; empty: string }) {
  return (
    <div className="mt-8">
      <Label>{title}</Label>
      {rows.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--ink-2)" }}>
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="text-[12px]" style={{ color: "var(--muted)" }}>
                <th className="font-normal py-1.5 pr-4">Difference</th>
                <th className="font-normal py-1.5 pr-4">Reason</th>
                <th className="font-normal py-1.5 pr-4">Decided by</th>
                <th className="font-normal py-1.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, e]) => (
                <tr key={key} className="border-t align-top" style={{ borderColor: "var(--line-2)" }}>
                  <td className="mono text-[12.5px] py-2 pr-4 whitespace-nowrap">{key}</td>
                  <td className="py-2 pr-4 min-w-[240px]">{e.rationale}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{e.decidedBy}</td>
                  <td className="py-2 whitespace-nowrap">{day(e.decidedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
