# Parity

**Behavioural equivalence for AI-modernised COBOL.** Parity runs the legacy COBOL program and its modern translation side by side on tens of thousands of generated inputs, finds every input where they disagree, shrinks each disagreement to the simplest case a person can read, explains it against the COBOL source, and turns it into a decision someone has to make and sign.

It plugs into IBM Bob as an MCP server, so the loop — translate, check, decide, repair, certify — runs inside the development partner doing the translation.

Built for the IBM Bob 2.0 Hackathon.

**Hackathon timeline.** I prototyped Parity's core engine before the IBM Bob 2.0 Hackathon (commits from 23 Sept). During the event (25–27 Sept) I used IBM Bob to translate, check, repair and certify COBOL through Parity. The Bob sessions are in `bob_sessions/` and the rehearsal run is in `examples/bob-rehearsal/`.

---

## The problem

LLMs made COBOL translation cheap. They did not make it correct.

- A July 2026 study found plain LLM COBOL translations behaved correctly on roughly **44–53%** of 319 programs from IBM's CodeNet set ([SEDCoT, arXiv 2607.04092](https://arxiv.org/html/2607.04092)).
- In February 2026, a public demonstration of AI COBOL translation prompted a backlash whose core point was simple: translation is not modernisation, and you need proof the new system behaves the same ([CIO](https://www.cio.com/article/4141171/what-the-cobol-translation-backlash-gets-right-and-wrong.html), [HyperFRAME Research](https://hyperframeresearch.com/2026/05/22/the-behavior-first-paradigm-moving-mainframe-modernization-past-llm-wishful-thinking/)).

The dangerous differences aren't the ones that fail to compile. They're the ones that read correctly and quietly change what happens to money.

## What Parity found

`examples/interest` is a legacy daily-interest and fee step. Its Java translation is a *careful* one — `BigDecimal` throughout, `HALF_UP` where the COBOL says `ROUNDED`, truncation where it doesn't. No strawman. Parity found twelve behavioural differences in 20,000 inputs. The first, shrunk automatically to its simplest form:

```
input   F-TYPE S   BALANCE 0.00   RATE 0.0000   DAYS 0

              legacy COBOL    modern Java
O-NEW         0000012.50      -0000012.50
```

**An empty account is charged the 12.50 fee. The mainframe says the customer now *has* 12.50. The Java says they *owe* it.** `NEW-BAL` is declared `PIC 9(7)V99` — no `S` — so the legacy program has been silently storing every negative balance as a positive one. It happens on 35% of generated inputs. On cutover day, every one of those accounts changes.

Is that a bug to fix, or behaviour downstream systems depend on? Parity doesn't guess. It asks.

`examples/payroll` shows a different class entirely. Its translation uses `HALF_EVEN` — banker's rounding, the mode most Java style guides recommend for money. COBOL's `ROUNDED` is half away from zero. They disagree on exactly the half-cent cases:

```
input   F-CODE S   HOURS 0.5   RATE 0.01          (0.5 × 0.01 = 0.005)

              legacy COBOL    modern Java
O-GROSS       00000.01        00000.00
```

Ordinary test data almost never lands on a half cent. Parity found 632.

## How it works

```
                 ┌──────────────── parity.json ────────────────┐
                 │ legacy: interest.cbl   modern: java Interest │
                 └─────────────────────────────────────────────┘
                                      │
   1  read the COBOL        PICTURE clauses → input domains
                            IF BALANCE < 1000 → test 999.99, 1000.00, 1000.01
                            MOVE NEW-BAL TO O-NEW → classify O-NEW by NEW-BAL
                                      │
   2  generate               boundary · harvested · random   (seeded)
                                      │
   3  execute         ┌───────────────┴───────────────┐
                      ▼                               ▼
               GnuCOBOL binary                  modern program
                      └───────────────┬───────────────┘
                                      │  ~15,000 input pairs / second
   4  classify         sign-loss · high-order-truncation · rounding
                       input-overflow · propagated · format · crash
                       + counterfactual re-run for out-of-range inputs
                                      │
   5  shrink           delta-debugging to the simplest input per finding
                                      │
   6  measure          GnuCOBOL -ftraceall → statement + decision coverage
                                      │
   7  decide           ledger: PRESERVE or ACCEPT, with who and why
                                      │
                       verdict + PARITY-CERTIFICATE.md
```

**Reading the COBOL.** A small, purpose-built reader extracts every data item's PICTURE, every literal a field is compared against, and the data flow into each output. That last part matters: `O-NEW` only formats a value; `NEW-BAL` *stores* it, and the storing field decides whether the sign and the leading digits survive.

**Classification by mechanism.** "Outputs differ" is useless to an engineer. Parity asks which COBOL storage behaviour, applied to the modern result, would reproduce the legacy result exactly — and names it: the sign was dropped by an unsigned field; leading digits were cut by a field too small; the last decimal differs by one step. Fields that differ only because an upstream field did are marked *derived* and don't need their own decision.

**Counterfactual input attribution.** When an input doesn't fit its field, the legacy program never saw the value it was given — only what the field could hold. Parity re-runs the modern code on *that* value. Outputs that then agree were caused by the input; outputs that still disagree have an independent cause and are classified on their own. Without this, one oversized input smears into every finding on its record.

**Shrinking.** Every finding's first example is minimised by delta debugging — zeroing fields, dropping digits, flipping signs — while the same finding still reproduces. That's how a random record becomes `S,0.00,0.0000,0`.

**Coverage.** Zero divergences means nothing if half the program never ran. A second GnuCOBOL build with `-ftraceall` logs every statement executed; Parity reports statements reached and IF statements seen going *both* ways.

**Deterministic explanations.** Every sentence Parity writes is filled from facts — the declaration line, the PICTURE, the statement that wrote the value. Bob does the reasoning about how to fix it. Parity only states what is true.

## The decision ledger

Some differences are translation bugs. Others are *legacy* bugs the business has lived with for decades. Silently copying them into the new system isn't obviously right. Silently fixing them isn't either — real customers' numbers change.

So Parity doesn't force equivalence. It forces a decision:

- **PRESERVE** — the modern code must reproduce the legacy behaviour. The finding blocks until it's fixed.
- **ACCEPT** — an intentional, documented change. The finding is allowed to remain.

Each decision records who made it and why, in `parity-ledger.json`, committed next to the code. The verdict is one of:

| Verdict | Meaning |
|---|---|
| `EQUIVALENT` | No difference in any input tried. |
| `EQUIVALENT_WITH_DECLARED_CHANGES` | Every remaining difference was accepted by a named person, with a reason. |
| `DIVERGENT` | Something is undecided, or preserved and not yet fixed. |

The certificate that comes out of this is the artefact a risk officer or an auditor signs — not "the tests pass", but *every behavioural change in this migration, and who approved it.*

## Measured

```
No false positives
  faithful translations, 2 programs × 5 seeds × 20,000 inputs
  200,000 inputs — zero divergences reported

Detection
  INTEREST   12 root findings · 10,078 / 20,000 inputs diverge
  PAYROLL     7 root findings ·  2,408 / 20,000 inputs diverge

Coverage (legacy)
  INTEREST   20/20 statements · 2/2 IFs both ways
  PAYROLL    27/27 statements · 4/4 IFs both ways

Throughput   ~15,000–17,500 input pairs per second (batched, both legs)

Aimed inputs
  random inputs alone never (or <5% of the time) produced
  7 of 12 INTEREST findings and 4 of 7 PAYROLL findings
```

**The false-positive number is the one that matters.** A verifier that cries wolf gets ignored. Each example ships a *faithful* translation — the ordinary one, repaired using `java/Pic.java` so every store reproduces the legacy field's truncation and sign behaviour. Across 200,000 inputs, Parity reports nothing for them. Every finding in the ordinary translations is therefore a real behavioural difference, not noise.

The aimed-inputs figure deserves precision: most of the findings random inputs miss are out-of-range inputs, which random sampling within a field's range never produces by design. The in-range exception is `NEW-BAL` losing sign *and* leading digits at once, which only the boundary strategy reached.

### What building it taught us

- **You can't reason your way to equivalence.** The careful interest translation assumed COBOL truncates `12.50 + BALANCE * 0.001` to two decimals. GnuCOBOL gives `12.50` for a balance of `-0.01` where the translation gives `12.49` — the intermediate product is carried at four decimals before the add. No reviewer would guess that. Parity hit it on the 15th input.
- **Blame is harder than detection.** The first version attributed divergences to whatever out-of-range input happened to be present, which blamed `RATE = 10.0000` for a sign-loss it had nothing to do with. The counterfactual re-run fixed it.
- **The verifier must not be the translator.** An agent grading its own translation is a student marking their own exam. Bob translates; Parity executes both programs and reports what happened.

## Using it

Needs Node 20+, a JDK, and GnuCOBOL (`apt install gnucobol3`; on Windows, inside WSL).

```bash
npm install
npm run selftest                       # the numbers above, ~3 minutes
npm run e2e                            # the full Bob loop over MCP

npm run parity -- inspect examples/interest
npm run parity -- check   examples/interest
npm run parity -- decide  examples/interest O-NEW:sign-loss accept "Correct the legacy defect at cutover" --by "Head of Finance"
npm run parity -- certificate examples/interest
```

### With Bob

Register the MCP server (`bob/mcp-servers.example.json`) and add the skill in `bob/skills/modernize-with-parity/`. The skill tells Bob to:

1. `parity_inspect` the legacy program before translating
2. translate
3. `parity_check`
4. explain each open finding to the user in business terms and **ask** — never decide — then `parity_decide` with their answer and reason
5. repair the PRESERVE findings using `Pic.store` / `Pic.storeRounded`
6. repeat until equivalent
7. `parity_certificate`

Bob's approval model puts a human on every `parity_decide` call, so the ledger is human-approved by construction.

### The contract

```json
{
  "legacy": { "source": "interest.cbl", "dialect": "ibm" },
  "modern": { "build": "javac -d .parity/build/modern Interest.java",
              "run": "java -cp .parity/build/modern Interest" },
  "inputs":  [{ "name": "F-TYPE", "values": ["S","P","C"] }, { "name": "BALANCE" }, { "name": "RATE" }, { "name": "DAYS" }],
  "outputs": ["O-INT", "O-FEE", "O-NEW"]
}
```

Input and output names are COBOL data items; their PICTUREs define the domain. Both programs read one delimited record per line on stdin and write one per line on stdout. The modern side can be any language.

## Prior art

This is differential testing, a technique with a long history. What's specific here is how it's aimed, attributed, and wired into the agent doing the translation.

- **IBM Research** validates watsonx Code Assistant for Z translations by generating unit tests from the COBOL with symbolic execution and running them as JUnit against the Java ([IBM Research](https://researcher.watson.ibm.com/publications/automated-testing-of-cobol-to-java-transformation)). Parity executes both programs directly, classifies differences by COBOL storage mechanism, and runs inside Bob's loop rather than as a separate validation stage.
- **Mechanical Orchard** (Imogen) validates against captured production traffic. Parity needs no production data — it generates inputs from the program's own declarations — which makes it usable on day one, before any traffic capture exists.
- **SEDCoT** (COBOL → C) and **Kaizen** (HPC translation) are 2026 research systems using symbolic execution, delta debugging and differential fuzzing to *improve* translations. Parity borrows the same families of technique; its additions are storage-mechanism classification, counterfactual input attribution, and the decision ledger — treating some differences as business decisions rather than defects.

## Limits

Stated plainly, because a verifier that overstates its coverage is worse than none.

- **Not proof.** Agreement on every input tried, with inputs aimed at known disagreement points. Not formal equivalence.
- **GnuCOBOL is not IBM Enterprise COBOL.** The legacy leg runs under GnuCOBOL with `-std=ibm`, which approximates z/OS behaviour — including intermediate precision, which is exactly where the two can differ. The runner is one function; running the legacy leg on real z/OS through Zowe is the obvious next step.
- **Batch programs through a driver.** Both legs speak line-delimited records on stdin/stdout. Programs built on CICS, DB2 or VSAM need a driver around them; Parity doesn't emulate those.
- **The COBOL reader is deliberately small.** It handles the constructs in these examples — fixed-format source, DISPLAY numerics, COMPUTE / MOVE / ADD / SUBTRACT / MULTIPLY / DIVIDE, IF comparisons against literals. `EVALUATE`, `REDEFINES`, `OCCURS` and COMP-3 packed decimal are not yet modelled.
- **Coverage is statement and IF-outcome, not path.**

## Who it's for

Banks, insurers and public-sector bodies modernising COBOL estates — the customers IBM's Bob Premium Packages for mainframe and Java modernisation are sold to. They don't need another tool that writes Java. They need the evidence to sign off on switching the old system off.

Priced per program certified, or per seat alongside the agent. The certificate is the wedge: it's what the change-approval board asks for, and today it's assembled by hand.

## Repository

```
src/cobol/        PICTURE semantics, COBOL reader
src/gen.ts        input domains and aimed generation
src/run.ts        batched differential runner
src/classify.ts   mechanism-level classification
src/engine.ts     the check: generate → run → classify → attribute → shrink → cover → verdict
src/ledger.ts     decisions
src/report.ts     terminal view and certificate
src/mcp.ts        MCP server for Bob
src/cli.ts        command line
java/Pic.java     COBOL storage semantics for Java — preserving legacy behaviour in one call
bob/              Bob skill, rule, MCP config
examples/         interest and payroll: legacy, ordinary translation, faithful translation
dashboard/        report viewer (Next.js), bundled with real runs
test/             self-test and MCP end-to-end
```

MIT. Built by [@BTN101](https://github.com/BTN101).
