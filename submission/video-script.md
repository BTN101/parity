# Parity — demo video script

**Hard limit: 3:00. Aim for 2:50.** Judges stop watching at 3:00, and at least 90 seconds must show Parity working on screen. In this script the demo runs from 0:25 to 2:15 (110 s), with the dashboard after it. Record at 1080p with Bob's IDE on screen. Narration is about 400 words, which fits at a calm pace. Rehearse once end to end before recording.

---

## 0:00–0:25 — The problem (25 s)

> *On screen: interest.cbl open in Bob.*

"This is COBOL. It still runs the core of banking, and IBM Bob can translate it into Java in minutes. But does the Java actually do the same thing? In a study this July, only about half of plain AI translations did. The dangerous differences don't crash. They look right."

---

## 0:25–1:15 — Bob translates, Parity checks (50 s)

> *Prompt Bob: "Translate interest.cbl to Java, then verify it with Parity."*

"I'm asking Bob to translate this interest-and-fee program. Parity is plugged into Bob as an MCP server."

> *Let Bob write the Java (speed this part up in the edit). Bob calls parity_check. Show the verdict.*

"Parity just ran the COBOL and Bob's Java side by side on twenty thousand inputs, aimed at exactly where COBOL and Java handle numbers differently. Verdict: divergent."

> *Lead with the most striking finding from Bob's run.*

**If it's the sign finding:**
"A customer with zero dollars is charged a twelve-fifty fee. The old system says they now **have** twelve-fifty. The Java says they **owe** it. The old field can't hold a minus sign."

**If Bob invented a rule** (only if it really happens, see notes):
"Bob added a fee rule that isn't in the original program. It looks like sensible banking logic, and it's wrong for thousands of customers. Nobody would catch that by reading."

---

## 1:15–2:15 — Decide, repair, certify (60 s)

"Some of these are Bob's bugs. Some are quirks of the old code the bank has lived with for years. Which is which is a business decision, and Parity makes a person take it."

> *Bob asks you. Decide the headline finding out loud, then the rest in one go:*
> - output formatting, invented rule, rounding → **preserve** ("fees must match to the cent")
> - out-of-range inputs → **accept** ("invalid input, rejected upstream")
> - the sign finding, if it appears → **accept** ("legacy defect, fix it at cutover")

> *Show Bob's approval prompt, approve. Bob repairs and runs parity_check again.*

"Every decision goes into a signed ledger. Bob fixes the rest and checks again. Bob's *explanation* of a fix can be wrong. It doesn't matter: Parity checks what the code does, not what Bob says."

> *Verdict: EQUIVALENT WITH DECLARED CHANGES. Call parity_certificate, scroll it.*

"Equivalent, with the declared changes signed. This certificate is what a change board needs before switching the mainframe off."

---

## 2:15–2:45 — Why you can trust it (30 s)

> *Cut to the dashboard (live URL). Click a finding → the COBOL line highlighted → the payroll rounding finding.*

"Each difference is shown against the COBOL line that causes it. Here's a different trap: half a cent rounds up in COBOL and down in the Java. Ordinary test data almost never hits that. Parity found over six hundred.

And it doesn't cry wolf: on translations built to match COBOL exactly, two hundred thousand inputs, zero false alarms."

---

## 2:45–2:55 — Close (10 s)

> *Back to the certificate or the Parity title card.*

"AI made COBOL translation cheap. Parity makes it trustworthy."

---

## Recording notes

- **Honesty rule for the invented-rule beat:** in rehearsal, Parity's own `parity_inspect` wording nudged Bob into inventing the C-type rule. That wording is fixed. Only claim Bob invented a rule if it happens again in the real recording.
- **Bob's live translation will differ from the shipped example.** Whatever Parity finds on *Bob's* Java is your demo. Adjust the words, not the facts.
- **If Bob gets it right first time** (EQUIVALENT), say so: "Bob got this one right, and here's the certificate proving it." Then show the shipped `Interest.java` finding on the dashboard.
- **Speed up waiting, never cut the loop.** Bob writing code and tool calls running can be sped up 2–4× in the edit. The 90 seconds of "solution in action" must stay visible.
- **Backup take:** record `npm run e2e` in the terminal. It runs the whole loop over MCP in under a minute.
- **Read numbers off the screen, don't recite them.**
- **Over 2:55? Cut from 2:15–2:45, never from the demo.**
- **Export the Bob task history and the consumption-summary screenshot right after recording** (into `bob_sessions/`).
