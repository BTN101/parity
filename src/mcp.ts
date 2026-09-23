#!/usr/bin/env -S npx tsx
/**
 * Parity as an MCP server — the interface Bob drives.
 *
 * The loop this enables:
 *
 *   Bob translates COBOL → Java
 *     → parity_check           finds every behavioural difference, shrunk to
 *                              its simplest input, explained against the source
 *     → Bob asks the user      preserve the legacy behaviour, or accept the
 *                              change? That's a business decision, not a
 *                              coding one, and Parity won't let the agent make
 *                              it alone.
 *     → parity_decide          records the decision in the ledger. Bob's own
 *                              approval prompt puts a human on every call.
 *     → Bob fixes the PRESERVE findings (Pic.store / Pic.storeRounded)
 *     → parity_check again     until the verdict is EQUIVALENT or
 *                              EQUIVALENT WITH DECLARED CHANGES
 *     → parity_certificate     the artefact that goes to sign-off
 *
 * The verifier is deliberately not the translator. An agent grading its own
 * translation is a student marking their own exam; Parity executes both
 * programs and reports what actually happened.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { check, type Report } from "./engine.js";
import { renderCertificate } from "./report.js";
import { decide, type Decision } from "./ledger.js";
import { loadContract } from "./contract.js";
import { parseCobol, storageOf } from "./cobol/parse.js";
import { buildDomains } from "./gen.js";
import { describePic } from "./cobol/pic.js";

const text = (t: string, isError = false): CallToolResult => ({ content: [{ type: "text", text: t }], isError });

function findingsForAgent(r: Report): string {
  const roots = r.findings.filter((f) => !f.derived);
  const lines: string[] = [];
  lines.push(`VERDICT: ${r.verdict}`);
  lines.push(r.summary);
  lines.push(
    `Ran ${r.inputsRun.toLocaleString("en-US")} inputs (seed ${r.seed}); legacy coverage ${r.coverage.statements.hit}/${r.coverage.statements.total} statements, ` +
      `${r.coverage.decisions.bothWays}/${r.coverage.decisions.total} decisions both ways.`,
  );
  if (!roots.length) return lines.join("\n");

  lines.push("");
  for (const f of roots) {
    lines.push(`--- ${f.key}  [${f.status.toUpperCase()}]  ${f.count} inputs`);
    lines.push(f.explanation.headline);
    lines.push(f.explanation.detail);
    lines.push(`Minimal counterexample:`);
    lines.push(`  input  ${f.minimal.input}`);
    lines.push(`  legacy ${f.minimal.legacy}`);
    lines.push(`  modern ${f.minimal.modern}`);
    for (const ref of f.explanation.refs) lines.push(`  source line ${ref.line}: ${ref.text}`);
    lines.push(`If preserved: ${f.explanation.preserveHint}`);
    lines.push("");
  }

  const open = roots.filter((f) => f.status === "open");
  const preserve = roots.filter((f) => f.status === "preserve");
  lines.push("NEXT STEPS:");
  if (open.length) {
    lines.push(
      `- ${open.length} finding(s) need a decision. Do NOT decide these yourself. For each, show the user the minimal ` +
        `counterexample in plain business terms and ask: PRESERVE the legacy behaviour, or ACCEPT the change as intentional? ` +
        `Then record their answer with parity_decide, including their reason.`,
    );
  }
  if (preserve.length) {
    lines.push(
      `- ${preserve.length} finding(s) are marked PRESERVE but still diverge. Change the modern code so it reproduces the legacy ` +
        `behaviour (hints above; java/Pic.java provides COBOL storage semantics), then run parity_check again.`,
    );
  }
  if (!open.length && !preserve.length) lines.push(`- Every remaining difference is an accepted change. Run parity_certificate.`);
  return lines.join("\n");
}

const server = new Server({ name: "parity", version: "0.1.0" }, { capabilities: { tools: {} } });

const DIR = {
  type: "string",
  description: "Directory containing parity.json, the legacy COBOL source and the modern translation.",
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "parity_inspect",
      description:
        "Read a legacy COBOL program and show what Parity will test: each input's domain from its PICTURE clause, the " +
        "literal edges harvested from its comparisons, and which field actually stores each output. Call before translating " +
        "to see where the semantic traps are.",
      inputSchema: { type: "object", properties: { dir: DIR }, required: ["dir"] },
    },
    {
      name: "parity_check",
      description:
        "Run the legacy COBOL and the modern translation side by side on thousands of generated inputs aimed at COBOL's " +
        "storage edge cases. Returns a verdict and every behavioural difference, each shrunk to a minimal counterexample and " +
        "explained against the COBOL source. Call after every change to the translation.",
      inputSchema: {
        type: "object",
        properties: {
          dir: DIR,
          n: { type: "number", description: "Inputs to generate (default 20000)." },
          seed: { type: "number", description: "Random seed, for reproducibility (default 1)." },
        },
        required: ["dir"],
      },
    },
    {
      name: "parity_decide",
      description:
        "Record the USER's decision on a finding: 'preserve' (the modern code must reproduce the legacy behaviour) or " +
        "'accept' (the difference is an intentional change). Only call this with a decision and reason the user gave you — " +
        "it is written to the migration's audit ledger.",
      inputSchema: {
        type: "object",
        properties: {
          dir: DIR,
          key: { type: "string", description: "Finding key from parity_check, e.g. O-NEW:sign-loss" },
          decision: { type: "string", enum: ["preserve", "accept"] },
          rationale: { type: "string", description: "The user's reason, in their words." },
          decidedBy: { type: "string", description: "Who made the decision." },
        },
        required: ["dir", "key", "decision", "rationale"],
      },
    },
    {
      name: "parity_certificate",
      description:
        "Write PARITY-CERTIFICATE.md from the latest check: what was run, legacy coverage, every difference found and the " +
        "decision recorded for each. The artefact for sign-off.",
      inputSchema: { type: "object", properties: { dir: DIR }, required: ["dir"] },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const a = (req.params.arguments ?? {}) as Record<string, unknown>;
  try {
    const dir = resolve(String(a.dir ?? "."));
    switch (req.params.name) {
      case "parity_inspect": {
        const c = loadContract(dir);
        const prog = parseCobol(readFileSync(join(c.dir, c.legacy.source), "utf8"));
        const domains = buildDomains(prog, c.inputs);
        const lines = [`${prog.programId}: ${prog.statements.length} statements, ${prog.ifLines.length} decisions.`, "", "Inputs:"];
        for (const d of domains) {
          lines.push(
            `  ${d.name} PIC ${d.spec.raw} — ${describePic(d.spec)}` +
              (d.harvested.length ? `; code compares it against edges ${d.harvested.join(", ")}` : "") +
              (d.values.length ? `; values ${d.values.join(", ")}` : ""),
          );
        }
        lines.push("", "Outputs and the fields that store them (these decide sign and overflow behaviour):");
        for (const o of c.outputs) {
          const s = storageOf(prog, o);
          if (s) lines.push(`  ${o} ← ${s.item.name} PIC ${s.item.pic.raw} (${describePic(s.item.pic)}), line ${s.item.line}`);
        }
        return text(lines.join("\n"));
      }
      case "parity_check": {
        const r = check(dir, { n: typeof a.n === "number" ? a.n : 20000, seed: typeof a.seed === "number" ? a.seed : 1 });
        return text(findingsForAgent(r), false);
      }
      case "parity_decide": {
        const decision = String(a.decision) as Decision;
        if (decision !== "preserve" && decision !== "accept") return text("decision must be 'preserve' or 'accept'", true);
        const c = loadContract(dir);
        decide(dir, c.name, String(a.key), decision, String(a.rationale ?? ""), String(a.decidedBy ?? "user, via Bob"));
        return text(`Recorded ${a.key} → ${decision}. Run parity_check to see the updated verdict.`);
      }
      case "parity_certificate": {
        const p = join(dir, ".parity", "report.json");
        if (!existsSync(p)) return text("No report yet — run parity_check first.", true);
        const md = renderCertificate(JSON.parse(readFileSync(p, "utf8")) as Report);
        writeFileSync(join(dir, "PARITY-CERTIFICATE.md"), md, "utf8");
        return text(`Wrote ${join(dir, "PARITY-CERTIFICATE.md")}\n\n${md}`);
      }
      default:
        return text(`Unknown tool ${req.params.name}`, true);
    }
  } catch (err) {
    return text((err as Error).message, true);
  }
});

await server.connect(new StdioServerTransport());
process.stderr.write("[parity] MCP server ready\n");
