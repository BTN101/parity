# Handover: Parity

The hackathon runs **Fri 25 Sep 17:00 SAST → Sun 27 Sep 17:00 SAST**. Registration closes at kickoff.

## Where it stands

| | |
|---|---|
| Engine: COBOL reader, aimed generation, differential runner, classifier, counterfactual attribution, shrinker, coverage | Built, tested |
| Decision ledger, verdicts, certificate | Built, tested |
| MCP server for Bob (4 tools) + Bob skill + rule | Built; full loop verified over MCP (16/16) |
| `java/Pic.java`: COBOL storage semantics for Java | Built; the no-false-positive result depends on it |
| Two example programs, each with ordinary and faithful translations | Built |
| Self-test: 200,000 inputs, zero false positives; every planted behaviour detected | Passing |
| Dashboard (Next.js) with four real runs bundled | Built, checked visually at desktop and 400px |
| README, video script, Lovable deck prompt | Written |

The one thing **not** verified: Parity running inside Bob on your machine. Nothing in my sandbox can test that. It's your first job below.

---

## Your list, in order

### 1. Register on lablab (5 minutes; skip if done)
Closes Friday 17:00 SAST. Even solo entrants need a team on the platform.

### 2. Set up on your PC (~30 minutes)
Your PC is almost certainly Windows. GnuCOBOL is easiest inside WSL.

```powershell
wsl --install -d Ubuntu          # once, then reboot if asked
```

Inside Ubuntu (WSL):

```bash
sudo apt update
sudo apt install -y gnucobol3 openjdk-21-jdk
# Node 20+ (Ubuntu's apt Node is often too old):
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc && nvm install 22

# unpack parity-source.tar.gz into ~/parity, then:
cd ~/parity && npm install
npm run selftest     # ~3 min; should end PASSED with "200,000 inputs, zero divergences"
npm run e2e          # ~1 min; should end PASSED — translate → check → decide → repair → certify
```

If `selftest` passes on your machine, the engine works there. If it fails, send me the output before doing anything else.

### 3. Connect Parity to Bob (~15 minutes)
- Install Bob (bob.ibm.com/trial; IDE **v2.0.2+**. v2.0.0 stops working 30 Sep).
- In Bob's MCP settings, add a server. From Windows, launch it through WSL:

```json
{
  "mcpServers": {
    "parity": {
      "command": "wsl",
      "args": ["-e", "bash", "-lc", "cd ~/parity && npx tsx src/mcp.ts"]
    }
  }
}
```

- Add the skill: Bob's Skills tab → add `bob/skills/modernize-with-parity/`.
- Check that Bob lists `parity_inspect`, `parity_check`, `parity_decide`, `parity_certificate`.
- Ask Bob to run `parity_inspect` on `~/parity/examples/interest`. If the field list comes back, the integration works.

Paths: Bob will pass `dir` to Parity. Give it the WSL path (`/home/<you>/parity/examples/...`). If you open the repo in Bob via VS Code's WSL remote, Bob and Parity share the same filesystem and paths just work. That's the smoothest route.

### 4. Rehearse the loop once, then record
Follow `video-script.md`. Do a full dry run first: have Bob translate `interest.cbl` fresh into a new folder with its own `parity.json` (copy `examples/interest/parity.json`, point `modern` at Bob's file). Bob's translation will differ from mine. Whatever Parity finds on *Bob's* Java is your real demo.

### 5. Deploy the dashboard (2 minutes)
```bash
cd dashboard && npx vercel --prod
```
Put the URL in the README and the submission. It's fully static, so there's nothing to configure.

### 6. Deck
Paste `lovable-deck-prompt.md` into Lovable. Check that the numbers survived exactly.

### 7. GitHub, then submit
Push to a public repo under BTN101 and submit on lablab: title, short description, video, deck, repo, dashboard URL.

---

## The git question: decide at kickoff, don't guess

The repo has commits dated **23 September**, before the event window. lablab's rule on pre-existing code never rendered (a JavaScript-only page), so the policy is **unknown**, not something I missed. Options, best first:

1. **Ask in the lablab Discord at kickoff.** One message removes the doubt.
2. **Push at kickoff and keep committing through the weekend.** Bob integration, your live translation, deployment and fixes are all real in-window work.
3. **Say plainly in the README what was built when.**

Don't squash or backdate to hide the timeline. Getting caught doing that is far worse than the question itself.

---

## If judges ask

**"Isn't this just differential testing?"** Yes, and the README says so. What's new is how it's aimed (reading the COBOL's own PICTURE clauses and comparisons), how differences are explained (by the COBOL storage mechanism that causes them), counterfactual attribution for bad inputs, and treating some differences as business decisions with a signed ledger.

**"How is this different from IBM's own validation for WCA for Z?"** IBM Research generates unit tests from the COBOL with symbolic execution and runs them against the Java. Parity executes both programs directly on aimed inputs, classifies differences by mechanism, and runs inside Bob's loop as it translates. They're complementary. Don't knock IBM's.

**"GnuCOBOL isn't a mainframe."** Correct, and it's in the limits. The legacy runner is one function; running it on z/OS through Zowe is the next step.

**"Why not let Bob decide?"** Some differences are legacy bugs. Whether to keep one is a business decision with real customers' money attached. An agent shouldn't make that alone, and an auditor won't accept it if it does.

**"Does it work on real programs?"** On batch programs like these, yes. The COBOL reader doesn't yet model EVALUATE, REDEFINES, OCCURS or packed decimal (COMP-3), and CICS/DB2/VSAM programs need a driver. Say that before they find it.

**"How do you know the findings are real?"** Faithful translations: 200,000 inputs, zero findings. Anything Parity reports on the ordinary translations is a genuine behavioural difference.
