import type { Report, Strategy } from "@/lib/types";
import { fmt } from "@/lib/review";
import { Card, Label } from "./ui";

const STRATEGY: Record<Strategy, string> = {
  boundary: "Edges of each field's size (largest, smallest, zero, just over)",
  harvested: "Values the COBOL itself compares against, and their neighbours",
  random: "Random values across each field's range",
};

export default function Technical({ r, source }: { r: Report; source: string }) {
  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card className="px-5 py-5">
          <Label>How the test cases were chosen</Label>
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-left" style={{ color: "var(--muted)" }}>
                <th className="font-normal pb-1.5">Strategy</th>
                <th className="font-normal pb-1.5 text-right">Cases</th>
                <th className="font-normal pb-1.5 text-right">Found a difference</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(STRATEGY) as Strategy[]).map((k) => (
                <tr key={k} className="border-t align-top" style={{ borderColor: "var(--line-2)" }}>
                  <td className="py-2 pr-3">
                    <div className="font-medium capitalize">{k}</div>
                    <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                      {STRATEGY[k]}
                    </div>
                  </td>
                  <td className="py-2 text-right mono tabular">{fmt(r.strategies[k].inputs)}</td>
                  <td className="py-2 text-right mono tabular">{fmt(r.strategies[k].divergent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
            {fmt(r.inputsRun)} cases in {(r.durationMs / 1000).toFixed(1)} s ({fmt(r.throughput)} pairs a second) · seed {r.seed}
          </p>
        </Card>

        <Card className="px-5 py-5">
          <Label>Inputs Parity read from the COBOL</Label>
          <ul className="space-y-3">
            {r.domains.map((d) => (
              <li key={d.name} className="text-[13.5px]">
                <span className="mono font-medium">{d.name}</span>{" "}
                <span className="mono text-[12.5px]" style={{ color: "var(--blue)" }}>
                  PIC {d.pic}
                </span>
                <div style={{ color: "var(--ink-2)" }}>{d.description}</div>
                {d.harvested.length > 0 && (
                  <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                    Compared against in the code: <span className="mono">{d.harvested.join(", ")}</span>
                  </div>
                )}
                {d.values.length > 0 && (
                  <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                    Values tested: <span className="mono">{d.values.join(", ")}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {source && <Source src={source} r={r} />}
    </div>
  );
}

function Source({ src, r }: { src: string; r: Report }) {
  const stmts = new Set(r.coverage.statementLines);
  const missed = new Set(r.coverage.missedLines);
  const oneWay = new Set(r.coverage.decisions.oneWay);
  return (
    <div className="crt rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b flex-wrap gap-2" style={{ borderColor: "#123a22" }}>
        <span className="mono text-[12px] tracking-[0.08em]" style={{ color: "var(--phosphor-dim)" }}>
          {r.source.toUpperCase()} · COVERAGE
        </span>
        <span className="mono text-[12px]" style={{ color: "var(--phosphor-dim)" }}>
          ● ran ◐ IF only went one way ○ never ran
        </span>
      </div>
      <div className="crt-scan overflow-auto max-h-[560px]">
        <pre className="mono text-[12.5px] leading-[1.6] py-3">
          {src.split("\n").map((text, i) => {
            const n = i + 1;
            return (
              <div key={n} className="flex pr-4">
                <span className="select-none w-12 text-right pr-3 shrink-0" style={{ color: "#1f5a33" }}>
                  {n}
                </span>
                <span className="select-none w-4 shrink-0" style={{ color: missed.has(n) ? "#ff6b6b" : "var(--phosphor-dim)" }}>
                  {stmts.has(n) ? (missed.has(n) ? "○" : oneWay.has(n) ? "◐" : "●") : ""}
                </span>
                <span>{text || " "}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
