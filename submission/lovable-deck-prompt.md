Build a pitch deck as a web slideshow for a hackathon submission. The product is called **Parity**.

## Goal

Judges at the IBM Bob 2.0 Hackathon will click through this deck in a couple of minutes, probably without me presenting. By the end they should understand three things: AI can now translate old COBOL banking code into Java cheaply, the translations quietly change how money behaves, and Parity is what proves they don't — or makes a named person sign off on every difference. It should feel like a serious engineering product, not a student project.

## What to build

A slideshow of about 10 slides, navigable with the arrow keys and clicks, that works well full-screen and looks good on a laptop. Slide numbers somewhere discreet. No login, no backend, nothing else — just the deck.

## The story, slide by slide

Use your judgement on layout and visuals. The facts and numbers below are real and must stay exactly as written.

1. **Title** — Parity. "Behavioural equivalence for AI-modernised COBOL." Built for the IBM Bob 2.0 Hackathon.
2. **The shift** — Banks, insurers and governments still run on COBOL. AI made translating it cheap. A July 2026 study found plain AI COBOL translations behaved correctly on only about 44–53% of programs.
3. **The danger** — The broken translations aren't the ones that fail to compile. They're the ones that read perfectly and quietly change what happens to money.
4. **The moment** (make this the most memorable slide) — An empty account gets charged a 12.50 fee. The 40-year-old COBOL says the customer now *has* 12.50. The careful, professional Java translation says they *owe* 12.50. The old field can't store a minus sign, so for decades it has silently turned debts into credits. On cutover day, every one of those accounts changes. Show it as a side-by-side: legacy on one side, modern on the other.
5. **What Parity does** — Runs the old COBOL and the new Java side by side on tens of thousands of generated inputs, aimed at the exact places COBOL and modern code disagree. Finds every difference, shrinks it to the simplest possible example, and explains it against the original source code.
6. **The twist: decisions, not just bugs** — Some differences are bugs in the *old* code that the business has lived with for years. Parity doesn't force the new code to copy them, or silently fix them. Each one becomes a decision — *preserve* the old behaviour or *accept* the change — signed by a named person with a reason. That ledger becomes the audit trail for the whole migration.
7. **It lives inside Bob** — Parity is an MCP server for IBM Bob. The loop: Bob translates → Parity checks → Bob asks the human to decide → Bob repairs → Parity certifies. The agent never makes the business decision itself. A simple loop diagram fits here.
8. **Proof it works** — Zero false positives across 200,000 inputs on translations that correctly reproduce the old behaviour. Real findings on ordinary translations: 12 behavioural differences in a banking interest program, 7 in a payroll program, including a banker's-rounding bug that ordinary test data almost never hits. ~15,000 comparisons per second. 100% of the legacy code's statements exercised.
9. **Who pays** — Banks, insurers and public-sector bodies modernising COBOL — the same customers IBM sells Bob's mainframe modernisation packages to. They don't need another tool that writes Java. They need evidence to sign off on switching the old system off. The certificate is the product.
10. **Honest limits and what's next** — It's rigorous testing, not mathematical proof. It runs COBOL through the open-source GnuCOBOL compiler, not a real IBM mainframe — next step is running the legacy side on real z/OS. Close with the one-line summary: *AI made COBOL translation cheap. Parity makes it trustworthy.*

## Theme

The feel is "mainframe meets modern": mostly clean, light and editorial, like a well-designed audit report or engineering document, with the old world showing up as a green-on-black terminal look wherever COBOL or legacy output appears. IBM Plex Sans and IBM Plex Mono would suit it perfectly. Restrained colour: near-black text, one strong blue accent, red for "divergent", green for "equivalent". Let the numbers and the side-by-side comparison carry the drama — no stock photos, no clip art, no gradients-for-the-sake-of-it.

Keep the writing tight: short headlines, a few lines of supporting text per slide, no walls of bullets.
