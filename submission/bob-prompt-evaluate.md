# Bob prompt: add EVALUATE support to Parity

Paste everything in the box below into Bob, with the `parity` folder open. Use **Code** mode. Approve each file change after you've read it, so Bob's session history shows a person reviewing the work.

```
I'm extending Parity, a tool in this repo that checks whether a Java translation of a
COBOL program behaves exactly like the original. Read README.md first, then
src/cobol/parse.ts, src/coverage.ts, src/gen.ts and test/selftest.ts.

GOAL
Parity currently understands IF statements but not EVALUATE, COBOL's switch statement.
Real banking code uses EVALUATE everywhere, so this is the biggest gap in Parity's COBOL
reader. Add support for it so Parity (1) aims its generated inputs at the values
and ranges an EVALUATE branches on, and (2) counts EVALUATE branches in its coverage.

WHAT TO SUPPORT
1. EVALUATE <field>  WHEN 'X' / WHEN 100 / WHEN OTHER
   -> each WHEN literal becomes a Comparison { field: <subject>, op: "=", literal }.
2. WHEN 100 THRU 199 (and THROUGH)
   -> two Comparisons on the subject: ">=" 100 and "<=" 199. THRU is inclusive at
      both ends, and those two boundaries are where translations go wrong.
3. EVALUATE TRUE  WHEN BALANCE < 1000
   -> the existing comparison regex should already catch the condition; make sure
      it does, and that WHEN lines don't break it.
4. Several WHEN lines sharing one body, and nested EVALUATEs (track the subject with a stack).
5. Coverage: an EVALUATE counts as a decision. It's fully covered when every arm,
   including WHEN OTHER, ran at least once. Check what GnuCOBOL's -ftraceall
   actually logs for WHEN lines before you decide how to detect an arm running
   (compile a tiny program with -ftraceall and look at the trace). Don't assume.
   Report EVALUATE arm coverage alongside the existing "IFs seen both ways".

A NEW EXAMPLE
Create examples/tiers/, a small COBOL batch program in the same style as
examples/interest (reads comma-separated lines, UNSTRING, DISPLAY outputs). It should
work out a card transaction fee using:
  - EVALUATE CHANNEL with WHEN 'A', WHEN 'B', WHEN OTHER
  - EVALUATE MONTH-COUNT with WHEN 0 THRU 4, WHEN 5 THRU 9, WHEN OTHER
  - at least one COMPUTE ... ROUNDED
Then add:
  - examples/tiers/Tiers.java: an ordinary, careful Java translation, written the
    way a good developer would write it. Don't plant bugs on purpose.
  - examples/tiers/faithful/: a translation that reproduces COBOL storage exactly,
    using java/Pic.java, like the other examples' faithful/ folders.
  - parity.json files for both, following the existing examples.

TESTS (all must pass)
- Add unit tests to test/selftest.ts for the parser: WHEN literals, THRU bounds,
  WHEN OTHER, EVALUATE TRUE, nested EVALUATE.
- Add "tiers" to the faithful no-false-positives loop. It must report zero
  differences on every seed.
- npm run selftest must end with PASSED.
- npm run e2e must still pass.

WHEN YOU'RE DONE
Run `npm run parity -- inspect examples/tiers` and `npm run parity -- check examples/tiers`
and show me the output. Tell me which differences Parity found in Tiers.java, if any,
and explain each one in plain English. Keep the existing code style: small functions,
comments that explain why, no new dependencies.
```

---

## What to check when Bob finishes

1. `npm run selftest` ends with **PASSED**. Screenshot it.
2. `npm run parity -- inspect examples/tiers` lists the THRU boundaries (0, 4, 5, 9) as edges for MONTH-COUNT, and A and B as the values CHANNEL branches on.
3. The coverage line shows EVALUATE arms as well as IFs.
4. The faithful `tiers` translation shows **0 differences**.
5. Export the Bob task history and the consumption screenshot into `bob_sessions/`.

If Parity finds real differences in Bob's `Tiers.java`, that's a second demo moment: Bob's own careful translation, caught at a THRU boundary. Only claim it if it actually happens.

**Numbers will change.** Adding a third program makes the no-false-positives total 300,000 inputs, and the differences count may change. Send me the new selftest output and I'll update the README, the deck and the submission text so they all match.
