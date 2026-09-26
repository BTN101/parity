import type { ReactNode } from "react";
import type { ReviewState } from "@/lib/review";

type Tone = "red" | "amber" | "green" | "blue" | "grey";

const TONES: Record<Tone, [string, string]> = {
  red: ["var(--red)", "var(--red-bg)"],
  amber: ["var(--amber)", "var(--amber-bg)"],
  green: ["var(--green)", "var(--green-bg)"],
  blue: ["var(--blue)", "#edf5ff"],
  grey: ["var(--muted)", "#ebeae6"],
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const [fg, bg] = TONES[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-[3px] rounded-full whitespace-nowrap" style={{ color: fg, background: bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: fg }} />
      {children}
    </span>
  );
}

export const STATE_LABEL: Record<ReviewState, { text: string; tone: Tone }> = {
  open: { text: "Needs decision", tone: "amber" },
  preserve: { text: "Keep old behaviour · fix pending", tone: "blue" },
  accept: { text: "Accepted change", tone: "green" },
  derived: { text: "Follows from another", tone: "grey" },
};

export function StatePill({ state }: { state: ReviewState }) {
  const s = STATE_LABEL[state];
  return <Pill tone={s.tone}>{s.text}</Pill>;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="text-[12px] font-medium uppercase tracking-[0.06em] mb-2" style={{ color: "var(--muted)" }}>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border ${className}`} style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
      {children}
    </div>
  );
}

/** A few lines of COBOL, on the green screen the legacy side lives on. */
export function CodeLines({ lines }: { lines: Array<{ line: number; text: string; note?: string }> }) {
  return (
    <div className="crt rounded-md overflow-x-auto">
      <pre className="mono text-[13px] leading-[1.7] py-2.5">
        {lines.map((l) => (
          <div key={l.line} className="flex pr-4">
            <span className="select-none w-12 text-right pr-3 shrink-0" style={{ color: "var(--phosphor-dim)" }}>
              {l.line}
            </span>
            <span className="whitespace-pre" style={{ color: "var(--phosphor-hi)" }}>
              {l.text.trim()}
            </span>
            {l.note && (
              <span className="ml-4 whitespace-nowrap" style={{ color: "var(--phosphor-dim)" }}>
                ← {l.note}
              </span>
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}
