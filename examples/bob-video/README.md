# Bob video session (27 Sept 2026)

The result of the IBM Bob session recorded for the demo video. The full task history is in [`bob_sessions/video-task-history.md`](../../bob_sessions/video-task-history.md).

- `interest.cbl` — the legacy COBOL program.
- `Interest.java` — the Java after Bob's repairs. `INTEREST` and `FEE` go through `Pic.java` so they reproduce COBOL storage exactly (preserved). `NEW-BAL` does not: its sign and overflow differences were accepted as legacy defects.
- `parity-ledger.json` — the 12 decisions: 4 preserve, 8 accept.
- `PARITY-CERTIFICATE.md` — Parity's certificate: EQUIVALENT WITH DECLARED CHANGES over 20,000 inputs, 20/20 statements and 2/2 decisions covered.

How the repair went: Bob's first fix didn't take effect, and Parity still reported the 4 preserved differences. Its second fix corrected one rounding case but broke another, and Parity produced a new counterexample (`S,-4.00,0.0000,0`). The third attempt, carrying `BALANCE * 0.001` at 4 decimal places as GnuCOBOL does, passed.

Re-run it from the repository root: `npm run parity -- check examples/bob-video`.
