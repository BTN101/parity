# lablab.ai submission — copy-paste text

Fill the fields in this order. Anything in [brackets] is yours to fill in.

---

## Project Title

Parity: proof that AI-translated COBOL still behaves like the original

## Short Description

Banks are using AI like IBM Bob to rewrite COBOL into Java. Parity runs the old and new programs side by side, finds every behavioural difference, and makes a person sign each one off before the mainframe is switched off.

## Technology & Category Tags

IBM Bob · MCP · COBOL · GnuCOBOL · Java · TypeScript · Node.js · Next.js · Mainframe Modernization · Differential Testing · Developer Tools · FinTech

---

## Long Description — Problem & Solution Statement

<!-- LONG-START -->
**The problem.** COBOL still runs the core of banking: 44 of the world's top 50 banks use IBM mainframes, and the people who wrote that code are retiring. AI can now translate a COBOL program into Java in minutes. The hard part is proving the new program does exactly what the old one did. In a 2026 study of 319 COBOL programs, only 44–53% of plain AI translations behaved correctly. The differences that slip through are invisible when you read the code. COBOL stores every number in a fixed-size field: a field without a sign silently drops minus signs, a field that's too small drops leading digits, and COBOL rounds halves differently from the rounding Java code often uses. Today teams hunt for these with hand-written tests and months of parallel running.

**The solution.** Parity is a behavioural equivalence checker for AI-modernised COBOL. It runs the original program (compiled with GnuCOBOL) and its Java translation side by side on tens of thousands of inputs. The inputs aren't random: Parity reads the COBOL's own field declarations and IF comparisons and aims at the exact boundaries where COBOL and Java disagree. Each difference is classified by the mechanism that causes it (sign loss, truncation, rounding), shrunk to the simplest input that still shows it, and explained against the COBOL line responsible.

Then a person decides: each difference becomes a PRESERVE decision (make the Java match the COBOL) or an ACCEPT decision (the change is intended), recorded in a signed ledger. When every remaining difference is accepted, Parity writes a certificate: the evidence a change board needs before cutover.

A real example: on a careful Java translation of a bank interest program, a customer with a $0 balance charged a $12.50 fee ends at +12.50 in COBOL, because the field has no sign, and −12.50 in Java. 35% of generated inputs hit it.

**Who uses it, and how.** Modernisation engineers, and the leads who sign off cutover. Parity runs inside IBM Bob as an MCP server with four tools (inspect, check, decide, certificate) plus a Bob skill that drives the loop: Bob translates, Parity checks, the engineer decides in Bob's approval prompt, Bob repairs, Parity certifies.

**What's new.** Differential testing isn't new. Parity adds: aiming inputs from the COBOL's own declarations; classifying differences by COBOL storage mechanism; counterfactual attribution, which re-runs the Java on the value the legacy field actually stored so one bad input isn't blamed for unrelated differences; and treating differences as business decisions with a ledger rather than as test failures.

**Evidence.** Zero false alarms across 200,000 inputs on translations built to match COBOL exactly. 19 real differences found across two programs, including 632 half-cent rounding cases that ordinary test data misses. 100% of legacy statements exercised, with every IF seen going both ways. When Bob translated the interest program itself, Parity found 8 differences: Bob repaired 5, 3 were accepted, and the result was certified.
<!-- LONG-END -->

---

## IBM Bob Usage Statement

<!-- BOB-START -->
Parity is built to live inside IBM Bob. Bob does the translating and repairing; Parity checks Bob's work; a person makes the decisions through Bob's approval prompts.

**How Parity plugs into Bob.** Parity is an MCP server registered in Bob's MCP settings. It exposes four tools: `parity_inspect` (reads a COBOL program's fields and branches), `parity_check` (runs COBOL and Java side by side and reports every difference), `parity_decide` (records a PRESERVE or ACCEPT decision in the ledger) and `parity_certificate` (writes the final certificate). A Bob skill, `modernize-with-parity`, and a rules file tell Bob how to run the loop: translate, check, ask the user to decide, repair, re-check, certify. Bob's approval prompt on `parity_decide` is what puts a named human on every decision.

**What Bob did in our test session.** We gave Bob `interest.cbl`, a COBOL interest-and-fee program, and asked it to translate it to Java and verify the result with Parity.
1. Bob called `parity_inspect` to learn the program's inputs, then wrote `Interest.java`.
2. Bob called `parity_check`. Verdict: DIVERGENT, 8 behavioural differences, including wrong output padding on three fields, a one-cent rounding gap on tiny balances, and a fee rule for account type "C" that doesn't exist in the COBOL.
3. For each difference, Bob asked me to decide. I chose PRESERVE for 5 and ACCEPT for 3 (out-of-range inputs treated as invalid data), and Bob recorded them with `parity_decide`.
4. Bob edited its Java to fix the 5 preserved differences and re-ran `parity_check`. Verdict: EQUIVALENT WITH DECLARED CHANGES.
5. Bob called `parity_certificate` to produce the signed certificate.

**Bob also improved Parity itself.** Watching Bob use the tools showed us a real design flaw. The invented "C" fee rule came from our `parity_inspect` wording: it listed test values next to real branch values, and Bob read them as business rules. We changed the output to state which values the code actually branches on. Bob was the first real user of Parity's interface, and its behaviour shaped it.

**During the hackathon.** [Fill in after you do it. For example: "Using Bob, we added EVALUATE support to Parity's COBOL reader (`src/cobol/parse.ts`) and a third example program (`examples/…`). Bob wrote the first draft of the parser change and the test; we reviewed and ran it."]

**Evidence.** Bob's exported task histories and the consumption-summary screenshot for each task are in `bob_sessions/` in the repository. The files Bob wrote or changed are [list them, e.g. `demo/Interest.java`, …].

**watsonx.** Parity doesn't use watsonx.ai or watsonx Orchestrate. Its checking is deterministic by design: a verifier for AI output shouldn't itself depend on an AI model.
<!-- BOB-END -->

---

## Application & Code

- **Public Code Repository:** https://github.com/BTN101/parity [make sure it's public]
- **IBM Bob Task Session Summary Screenshots:** in `bob_sessions/` (also upload them in the form if it asks)
- **Demo Application Platform:** Web (Next.js dashboard on Vercel) + MCP server for IBM Bob
- **Application URL:** [your Vercel dashboard URL]

## Media & Presentation

- **Cover Image:** `parity-cover.png` (1920×1080)
- **Video Demonstration:** MP4, 3:00 max, follow `video-script.md`
- **Slide Presentation:** download the deck as PDF
