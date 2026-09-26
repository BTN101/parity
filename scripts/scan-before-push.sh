#!/usr/bin/env bash
# Run before every push. Finds anything that looks like a credential in files git would publish.
cd "$(git rev-parse --show-toplevel)" || exit 1
# key = value assignments, private key blocks, IBM Cloud logins, and long random-looking strings
PATTERN='((api[_-]?key|apikey|secret|password|passwd|token|bearer)["'"'"']?\s*[:=]\s*["'"'"']?[^\s"'"'"']{8,}|BEGIN [A-Z ]*PRIVATE KEY|ibmcloud login|\b(?=[A-Za-z0-9_-]*[0-9])(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])[A-Za-z0-9_-]{32,}\b)'
FILES=$( (git ls-files; git ls-files --others --exclude-standard) | grep -vE '(^|/)(package-lock\.json|\.gitignore|\.bobignore)$|\.(png|jpg|jpeg|gif|pdf|woff2?)$|^scripts/scan-before-push\.sh$' )
HITS=$(echo "$FILES" | xargs -d '\n' grep -nIP "(?i)$PATTERN" 2>/dev/null)
if [ -n "$HITS" ]; then
  echo "Check these lines before pushing (most will be harmless words, look for real keys):"
  echo "$HITS"
  exit 1
fi
echo "No credential-like strings found in files that would be pushed."
