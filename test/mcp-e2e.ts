/**
 * The full repair loop, driven through MCP exactly as Bob would drive it.
 *
 *   1. inspect the legacy program
 *   2. check the first translation            → DIVERGENT, findings open
 *   3. record decisions (one ACCEPT, rest PRESERVE)
 *   4. check again                            → still DIVERGENT: preserved
 *                                               findings aren't fixed yet
 *   5. swap in the repaired translation
 *   6. check again                            → EQUIVALENT WITH DECLARED CHANGES
 *   7. certificate                            → records every decision
 *
 * Runs in a scratch copy so the example ledgers stay clean.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const G = "\x1b[32m", R = "\x1b[31m", D = "\x1b[2m", X = "\x1b[0m";
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  ${G}PASS${X} ${label}`);
  else {
    failures++;
    console.log(`  ${R}FAIL${X} ${label}${detail ? `\n       ${D}${detail.slice(0, 400)}${X}` : ""}`);
  }
};

const ROOT = resolve(".");
const work = mkdtempSync(join(tmpdir(), "parity-e2e-"));
cpSync(join(ROOT, "examples/interest/interest.cbl"), join(work, "interest.cbl"));
cpSync(join(ROOT, "examples/interest/Interest.java"), join(work, "Interest.java"));
cpSync(join(ROOT, "examples/interest/faithful/InterestDecided.java"), join(work, "InterestDecided.java"));
const contract = JSON.parse(readFileSync(join(ROOT, "examples/interest/parity.json"), "utf8"));
writeFileSync(join(work, "parity.json"), JSON.stringify(contract, null, 2));

const client = new Client({ name: "bob-simulator", version: "0.1.0" }, { capabilities: {} });
await client.connect(
  new StdioClientTransport({ command: join(ROOT, "node_modules/.bin/tsx"), args: [join(ROOT, "src/mcp.ts")], stderr: "pipe" }),
);
const call = async (name: string, args: Record<string, unknown>) => {
  const r = (await client.callTool({ name, arguments: args })) as CallToolResult;
  return (r.content as Array<{ type: string; text: string }>).map((c) => c.text).join("\n");
};

console.log(`\n${D}── Bob's repair loop over MCP ─────────────────────────${X}`);

const tools = (await client.listTools()).tools.map((t) => t.name);
ok("server exposes the four loop tools", ["parity_inspect", "parity_check", "parity_decide", "parity_certificate"].every((t) => tools.includes(t)), tools.join(","));

const inspect = await call("parity_inspect", { dir: work });
ok("inspect traces O-NEW to its storing field NEW-BAL", inspect.includes("O-NEW ← NEW-BAL PIC 9(7)V99"), inspect);
ok("inspect harvests the IF BALANCE < 1000 edge", inspect.includes("999.99, 1000, 1000.01"), inspect);

const first = await call("parity_check", { dir: work, n: 20000 });
ok("first translation is DIVERGENT", first.startsWith("VERDICT: DIVERGENT"), first.slice(0, 200));
ok("headline finding: NEW-BAL turns debts into credits", first.includes("O-NEW:sign-loss") && first.includes("a debt becomes a credit"));
ok("the agent is told not to decide on its own", first.includes("Do NOT decide these yourself"));
const keys = [...first.matchAll(/^--- (\S+)\s+\[OPEN\]/gm)].map((m) => m[1]);
ok("findings are open, awaiting decisions", keys.length >= 5, `${keys.length} open`);

for (const key of keys) {
  const accept = key === "O-NEW:sign-loss";
  const res = await call("parity_decide", {
    dir: work,
    key,
    decision: accept ? "accept" : "preserve",
    rationale: accept
      ? "Legacy defect: negative balances were stored as credits. Finance approves correcting it at cutover; affected accounts reconciled separately."
      : "Downstream settlement files depend on the legacy values; reproduce exactly.",
    decidedBy: "Head of Retail Finance",
  });
  if (!res.startsWith("Recorded")) ok(`decision recorded for ${key}`, false, res);
}
const ledger = JSON.parse(readFileSync(join(work, "parity-ledger.json"), "utf8"));
ok("every decision is in the ledger with who and why", Object.keys(ledger.entries).length === keys.length && Object.values(ledger.entries).every((e: any) => e.rationale && e.decidedBy));

const second = await call("parity_check", { dir: work, n: 20000 });
ok("decisions alone don't pass: preserved findings still diverge", second.startsWith("VERDICT: DIVERGENT") && second.includes("[PRESERVE]"));
ok("the accepted finding is marked accepted", second.includes("O-NEW:sign-loss  [ACCEPTED]"));

contract.modern = {
  label: "Java 21 (after repair loop)",
  build: `javac -d .parity/build/modern ${join(ROOT, "java/Pic.java")} InterestDecided.java`,
  run: "java -cp .parity/build/modern InterestDecided",
};
writeFileSync(join(work, "parity.json"), JSON.stringify(contract, null, 2));

const third = await call("parity_check", { dir: work, n: 20000 });
ok("repaired translation: EQUIVALENT WITH DECLARED CHANGES", third.startsWith("VERDICT: EQUIVALENT_WITH_DECLARED_CHANGES"), third.slice(0, 300));
ok("the only remaining difference is the accepted one", (third.match(/^--- /gm) ?? []).length === 1 && third.includes("O-NEW:sign-loss  [ACCEPTED]"));

const cert = await call("parity_certificate", { dir: work });
ok("certificate states equivalence with declared changes", cert.includes("Behavioural equivalence with declared changes"));
ok("certificate carries the accepted decision and who made it", cert.includes("Finance approves correcting it") && cert.includes("Head of Retail Finance"));
ok("certificate lists the preserved findings as resolved", cert.includes("## Resolved") && cert.includes("preserve: Downstream settlement files"));
ok("certificate states what it does not prove", cert.includes("What this does not prove"));

await client.close();
rmSync(work, { recursive: true, force: true });

console.log("");
if (failures) {
  console.log(`${R}FAILED${X} — ${failures} check(s)\n`);
  process.exit(1);
}
console.log(`${G}PASSED${X} — translate → check → decide → repair → certify\n`);
