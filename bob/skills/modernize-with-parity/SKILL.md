---
name: modernize-with-parity
description: Translate a legacy COBOL program to Java and prove the translation behaves identically, using the Parity MCP server. Use whenever modernising COBOL, or when asked whether a translation is equivalent to the original.
---

# Modernise COBOL with Parity

You are translating legacy COBOL. The translation is not done when it compiles or when it reads correctly. It is done when Parity says the two programs behave the same, or when every remaining difference is a decision the user made on purpose.

You are the translator. Parity is the verifier. Do not judge your own translation — run it.

## Loop

1. **Inspect first.** Call `parity_inspect` on the program directory. Note every output whose storing field is UNSIGNED or small: those fields silently drop signs and leading digits, and your translation must decide what to do about that.
2. **Translate.** Write the Java. Use `BigDecimal`. Keep the structure of the COBOL paragraphs recognisable.
3. **Check.** Call `parity_check`. Read every finding's minimal counterexample.
4. **Ask, don't decide.** For every finding marked OPEN, explain it to the user in business terms, using the counterexample — for example: *"An account with a zero balance that is charged the 12.50 fee ends up with +12.50 in the legacy system and −12.50 in the new one."* Ask whether to **preserve** the legacy behaviour or **accept** the change. Record their answer and their reason with `parity_decide`. Never record a decision the user didn't make.
5. **Repair.** For every PRESERVE finding, change the Java to reproduce the legacy behaviour. `java/Pic.java` implements COBOL storage: `Pic.of("9(7)V99").store(v)` for statements without ROUNDED, `.storeRounded(v)` for statements with it.
6. **Repeat** from step 3 until the verdict is `EQUIVALENT` or `EQUIVALENT_WITH_DECLARED_CHANGES`.
7. **Certify.** Call `parity_certificate` and tell the user where the certificate is.

## Rules

- A finding marked *derived* resolves when its cause does. Don't fix it separately.
- If a fix for one finding creates a new one, say so plainly rather than hiding it.
- `rounding` findings usually mean the translation used `HALF_EVEN`, or rounded where COBOL truncates. COBOL's ROUNDED is half away from zero.
- Don't reduce `n` to make a check pass faster. Equivalence claimed on fewer inputs is a weaker claim.
