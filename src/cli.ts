#!/usr/bin/env -S npx tsx
/**
 * parity inspect <dir>                          what Parity will aim at, and why
 * parity check   <dir> [--n 20000] [--seed 1]    run legacy and modern side by side
 * parity decide  <dir> <key> preserve|accept "<rationale>" [--by name]
 * parity certificate <dir>                      write PARITY-CERTIFICATE.md
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { check, type Report } from "./engine.js";
import { renderCertificate, renderTerminal } from "./report.js";
import { decide, type Decision } from "./ledger.js";
import { loadContract } from "./contract.js";
import { parseCobol, storageOf } from "./cobol/parse.js";
import { buildDomains } from "./gen.js";
import { describePic } from "./cobol/pic.js";

const [cmd, dirArg, ...rest] = process.argv.slice(2);

function flag(name: string, fallback?: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
}

function usage(): never {
  console.log(`usage:
  parity inspect <dir>
  parity check <dir> [--n 20000] [--seed 1] [--json]
  parity decide <dir> <finding-key> preserve|accept "<rationale>" [--by name]
  parity certificate <dir>`);
  process.exit(1);
}

if (!cmd || !dirArg) usage();
const dir = resolve(dirArg);

try {
  switch (cmd) {
    case "inspect": {
      const c = loadContract(dir);
      const prog = parseCobol(readFileSync(join(c.dir, c.legacy.source), "utf8"));
      const domains = buildDomains(prog, c.inputs);
      console.log(`\n${prog.programId} — ${prog.statements.length} statements, ${prog.ifLines.length} decisions\n`);
      console.log("Inputs (domain from PICTURE, edges from the code):");
      for (const d of domains) {
        const edges = d.values.length ? `values ${d.values.join(" / ")}` : d.harvested.length ? `compared against → tests ${d.harvested.join(", ")}` : "";
        console.log(`  ${d.name.padEnd(10)} PIC ${d.spec.raw.padEnd(10)} ${describePic(d.spec)}${edges ? `  ·  ${edges}` : ""}`);
      }
      console.log("\nOutputs (classified against the field that stores them):");
      for (const o of c.outputs) {
        const s = storageOf(prog, o);
        if (s) console.log(`  ${o.padEnd(10)} ← ${s.item.name.padEnd(10)} PIC ${s.item.pic.raw.padEnd(10)} ${describePic(s.item.pic)}  (line ${s.item.line})`);
      }
      console.log("");
      break;
    }
    case "check": {
      const r = check(dir, { n: Number(flag("n", "20000")), seed: Number(flag("seed", "1")) });
      if (rest.includes("--json")) console.log(JSON.stringify(r, null, 2));
      else console.log(renderTerminal(r));
      process.exitCode = r.verdict === "DIVERGENT" ? 2 : 0;
      break;
    }
    case "decide": {
      const [key, decision, rationale] = rest;
      if (!key || (decision !== "preserve" && decision !== "accept") || !rationale) usage();
      const c = loadContract(dir);
      decide(dir, c.name, key, decision as Decision, rationale, flag("by", process.env.USER ?? "unknown"));
      console.log(`recorded: ${key} → ${decision}`);
      break;
    }
    case "certificate": {
      const r = JSON.parse(readFileSync(join(dir, ".parity", "report.json"), "utf8")) as Report;
      const md = renderCertificate(r);
      writeFileSync(join(dir, "PARITY-CERTIFICATE.md"), md, "utf8");
      console.log(md);
      break;
    }
    default:
      usage();
  }
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
