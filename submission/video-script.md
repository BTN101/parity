# Parity — demo video script

**Target 4:00–4:30.** Judges reward clarity over polish, and the demo starts by 0:30. Record at 1080p with Bob's IDE and a terminal/browser. Rehearse once end to end before recording (see Handover).

---

## 0:00–0:30 — The problem

> *On screen: interest.cbl open in Bob.*

"This is COBOL. Banks still run on it: interest, fees, payroll. Bob can translate it into Java in seconds.

The question nobody can answer yet is: does the Java actually *do the same thing*? A study this July found plain AI translations of COBOL behaved correctly on about half of programs. And the dangerous failures aren't the ones that break. They're the ones that look right."

---

## 0:30–1:30 — Bob translates, Parity checks

> *Prompt Bob: "Translate interest.cbl to Java, then verify it with Parity."*

"I'm asking Bob to translate this interest-and-fee program. Parity is plugged into Bob as an MCP server."

> *Let Bob write the Java. Then Bob calls parity_check. Show the result.*

"Parity just ran the original COBOL and Bob's Java side by side on twenty thousand inputs. It didn't use random data. It read the COBOL's own field definitions and aimed at exactly the places COBOL and Java disagree."

> *Point at the verdict: DIVERGENT, and the top finding.*

"Here's the top finding, already shrunk to the simplest case. An empty account gets charged a 12.50 fee. The mainframe says the customer now **has** 12.50. The Java says they **owe** 12.50."

> *Pause on it.*

"The old field has no minus sign, so for decades it's been silently turning debts into credits. Bob's translation is *more correct*. And on cutover day it changes every one of those customers' balances."

---

## 1:30–2:30 — The decision, the repair, the certificate

"So is that a bug to fix, or behaviour the bank depends on? That's not Bob's call, and Parity won't let it be."

> *Bob asks you. Answer out loud / in chat:*
> "Accept the NEW-BAL change: that's a legacy defect, correct it at cutover. Preserve everything else exactly."

> *Bob calls parity_decide. Show Bob's approval prompt, then approve.*

"Every decision goes into a ledger with who made it and why. Bob's own approval prompt puts a human on every one."

> *Bob repairs the preserved findings and runs parity_check again.*

"Bob fixes the rest, using a small helper Parity ships that reproduces COBOL's storage rules in Java. Then it checks again."

> *Verdict: EQUIVALENT WITH DECLARED CHANGES. Then parity_certificate — scroll the certificate.*

"Equivalent, with one declared change, signed. This certificate is what a bank's change board actually needs to switch the old system off."

---

## 2:30–3:20 — Why you can trust it

> *Cut to the dashboard (live URL). Click through: finding → green-screen source highlight → the after-repair view → ledger.*

"The dashboard shows each difference against the original COBOL line that causes it.

A verifier is only useful if it doesn't cry wolf. So each example ships a translation that correctly reproduces the old behaviour, and across two hundred thousand inputs Parity reports **nothing** for it. Every finding you just saw is real.

It also measures itself. Every statement in the legacy program executed, every IF seen going both ways, at around fifteen thousand comparisons a second."

> *Switch to PAYROLL, click the rounding finding.*

"Different program, different trap. The Java uses banker's rounding, which style guides recommend for money. COBOL rounds halves away from zero. Half a cent, 0.005, becomes a cent in one system and zero in the other. Ordinary test data almost never lands on a half cent. Parity found over six hundred."

---

## 3:20–4:10 — Who it's for, and honest limits

"Who buys this: banks, insurers and governments modernising COBOL, the exact customers IBM sells Bob's mainframe modernisation packages to. They don't need another tool that writes Java. They need evidence to turn the old system off.

What it isn't: it's rigorous testing, not mathematical proof. It runs COBOL on the open-source GnuCOBOL compiler, not a real mainframe, and the next step is running the legacy side on z/OS. And the COBOL reader handles batch programs like these, not every construct yet.

AI made COBOL translation cheap. Parity makes it trustworthy."

---

## Recording notes

- **Bob's live translation will differ from the shipped example.** That's the point, and it's real. Whatever Parity finds on *Bob's* Java is your demo. If Bob's translation already handles the sign, then the rounding or truncation findings lead instead. Adjust the words, not the facts.
- **If Bob gets it perfectly right** (EQUIVALENT on the first check), say so. "Bob got this one right, and here's the certificate proving it" is a strong beat. Then show the shipped `Interest.java` finding on the dashboard.
- **Backup take:** record `npm run e2e` in the terminal. It runs the whole loop over MCP in under a minute, 16 checks. Less cinematic, still proof.
- **Read numbers off the screen, don't recite them.**
- **Over 4:30? Cut from 3:20–4:10, never from the demo.**
