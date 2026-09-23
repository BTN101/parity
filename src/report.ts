/**
 * Rendering: the terminal view and the equivalence certificate.
 *
 * The certificate is written to be read by someone who will never open the
 * code — a risk officer, an auditor, the person who signs off the cutover. It
 * states what was run, how much of the legacy program it reached, every
 * behavioural difference found, and who decided what about each one.
 */

import type { Finding, Report } from "./engine.js";

const C = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

const KIND_LABEL: Record<string, string> = {
  "sign-loss": "sign lost",
  "sign-loss+truncation": "sign + digits lost",
  "high-order-truncation": "digits truncated",
  rounding: "rounding",
  value: "logic",
  propagated: "follows upstream",
  "input-overflow": "input too large",
  "input-sign-loss": "input sign lost",
  format: "text format",
  crash: "crash",
};

function pct(n: number): string {
  return n >= 0.1 ? `${(n * 100).toFixed(0)}%` : `${(n * 100).toFixed(1)}%`;
}

function statusTag(f: Finding, color: boolean): string {
  const c = color ? C : { red: "", green: "", yellow: "", dim: "", reset: "" };
  if (f.derived) return `${c.dim}derived${c.reset}`;
  if (f.status === "accepted") return `${c.green}ACCEPTED${c.reset}`;
  if (f.status === "preserve") return `${c.red}PRESERVE — still diverges${c.reset}`;
  return `${c.yellow}NEEDS DECISION${c.reset}`;
}

export function renderTerminal(r: Report): string {
  const lines: string[] = [];
  const verdictColor = r.verdict === "DIVERGENT" ? C.red : C.green;

  lines.push("");
  lines.push(`${C.bold}PARITY${C.reset}  ${r.program} (${r.source})  vs  ${r.modernLabel}`);
  lines.push(
    `${C.dim}${r.inputsRun.toLocaleString("en-US")} inputs · ${r.throughput.toLocaleString("en-US")} pairs/s · ` +
      `${r.coverage.statements.hit}/${r.coverage.statements.total} statements · ` +
      `${r.coverage.decisions.bothWays}/${r.coverage.decisions.total} decisions both ways · seed ${r.seed}${C.reset}`,
  );
  lines.push("");
  lines.push(`${verdictColor}${C.bold}${r.verdict.replace(/_/g, " ")}${C.reset}  ${r.summary}`);

  const roots = r.findings.filter((f) => !f.derived);
  const derived = r.findings.filter((f) => f.derived);

  if (roots.length) {
    lines.push("");
    for (const f of roots) {
      lines.push(
        `${C.bold}${f.field}${C.reset} ${C.cyan}${KIND_LABEL[f.kind] ?? f.kind}${C.reset}  ` +
          `${C.dim}${f.count.toLocaleString("en-US")} inputs (${pct(f.share)})${C.reset}  ${statusTag(f, true)}`,
      );
      lines.push(`  ${f.explanation.headline}`);
      lines.push(`  ${C.dim}input ${C.reset}${f.minimal.input}`);
      lines.push(`  ${C.dim}legacy${C.reset} ${f.minimal.legacy}`);
      lines.push(`  ${C.dim}modern${C.reset} ${f.minimal.modern}`);
      const decl = f.explanation.refs.find((x) => x.role === "declaration");
      if (decl) lines.push(`  ${C.dim}line ${decl.line}: ${decl.text}${C.reset}`);
      lines.push(`  ${C.dim}key ${f.key}${C.reset}`);
      lines.push("");
    }
  }
  if (derived.length) {
    lines.push(`${C.dim}Derived (resolve with their cause): ${derived.map((f) => `${f.field} ← ${f.from}`).join(", ")}${C.reset}`);
  }

  const s = r.strategies;
  lines.push(
    `${C.dim}Found by: boundary ${s.boundary.divergent}/${s.boundary.inputs} · harvested ${s.harvested.divergent}/${s.harvested.inputs} · random ${s.random.divergent}/${s.random.inputs}${C.reset}`,
  );
  lines.push("");
  return lines.join("\n");
}

export function renderCertificate(r: Report): string {
  const roots = r.findings.filter((f) => !f.derived);
  const title =
    r.verdict === "EQUIVALENT"
      ? "Behavioural equivalence: no differences found"
      : r.verdict === "EQUIVALENT_WITH_DECLARED_CHANGES"
        ? "Behavioural equivalence with declared changes"
        : "Behavioural differences outstanding";

  const out: string[] = [];
  out.push(`# Parity certificate — ${r.program}`);
  out.push("");
  out.push(`**${title}.** ${r.summary}`);
  out.push("");
  out.push(`| | |`);
  out.push(`|---|---|`);
  out.push(`| Legacy | \`${r.source}\` (GnuCOBOL, \`-std=${r.dialect}\`) |`);
  out.push(`| Modern | ${r.modernLabel} |`);
  out.push(`| Inputs | ${r.inputsRun.toLocaleString("en-US")} generated, seed ${r.seed} (reproducible) |`);
  out.push(`| Statements exercised | ${r.coverage.statements.hit} of ${r.coverage.statements.total} |`);
  out.push(`| Decisions exercised both ways | ${r.coverage.decisions.bothWays} of ${r.coverage.decisions.total} |`);
  out.push(`| Generated | ${r.generatedAt} |`);
  out.push("");

  out.push(`## Input domain`);
  out.push("");
  out.push(`Derived from the legacy program's own declarations and comparisons.`);
  out.push("");
  for (const d of r.domains) {
    const extra = d.values.length ? `values ${d.values.join(", ")}` : d.harvested.length ? `edges from code: ${d.harvested.join(", ")}` : "";
    out.push(`- **${d.name}** \`PIC ${d.pic}\` — ${d.description}${extra ? `; ${extra}` : ""}`);
  }
  out.push("");

  if (roots.length) {
    out.push(`## Findings`);
    out.push("");
    for (const f of roots) {
      const status =
        f.status === "accepted" ? "Accepted as an intentional change" : f.status === "preserve" ? "Must preserve legacy behaviour — **not yet fixed**" : "**Awaiting decision**";
      out.push(`### ${f.explanation.headline}`);
      out.push("");
      out.push(`${status}. Seen on ${f.count.toLocaleString("en-US")} of ${r.inputsRun.toLocaleString("en-US")} inputs.`);
      out.push("");
      out.push(f.explanation.detail);
      out.push("");
      out.push("```");
      out.push(`input   ${f.minimal.input}`);
      out.push(`legacy  ${f.minimal.legacy}`);
      out.push(`modern  ${f.minimal.modern}`);
      out.push("```");
      for (const ref of f.explanation.refs) out.push(`- line ${ref.line}: \`${ref.text}\``);
      if (f.decision) {
        out.push("");
        out.push(`> **Decision:** ${f.decision.decision} — ${f.decision.rationale}  `);
        out.push(`> ${f.decision.decidedBy}, ${f.decision.decidedAt}`);
      }
      out.push("");
    }
  }

  if (r.resolvedDecisions.length) {
    out.push(`## Resolved`);
    out.push("");
    out.push(`Decided, then fixed in the modern code. No longer observed.`);
    out.push("");
    for (const d of r.resolvedDecisions) out.push(`- \`${d.key}\` — ${d.decision}: ${d.rationale} (${d.decidedBy}, ${d.decidedAt})`);
    out.push("");
  }

  out.push(`## What this does not prove`);
  out.push("");
  out.push(
    `This is differential testing, not formal proof: it shows the programs agree on every input tried, chosen to target the ` +
      `places COBOL and modern arithmetic are known to disagree. The legacy leg runs under GnuCOBOL in IBM compatibility mode, ` +
      `which approximates but is not IBM Enterprise COBOL on z/OS. Programs that use CICS, DB2 or VSAM are exercised through ` +
      `a driver, not natively.`,
  );
  out.push("");
  return out.join("\n");
}
