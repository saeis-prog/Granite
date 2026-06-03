#!/usr/bin/env bash
# ============================================================
# Granite — push to GitHub (saeis-prog/Granite, branch: main)
# Usage:
#   ./push.sh                 # commits with a default message
#   ./push.sh "your message"  # commits with your own message
# ============================================================
set -euo pipefail

# Always run from the repo root (the folder this script lives in)
cd "$(dirname "$0")"

# ── Clear stale git lock files ──────────────────────────────
# A crashed/interrupted git (or a file-sync tool like Dropbox) can leave a
# .lock behind that blocks every subsequent git command. Remove them ONLY if
# no git process is currently running, so we never disturb a live operation.
if pgrep -x git >/dev/null 2>&1; then
  echo "✗ A git process is already running — not touching locks. Wait for it to finish, then re-run." >&2
  exit 1
fi
for lock in index.lock config.lock HEAD.lock shallow.lock ORIG_HEAD.lock; do
  if [ -e ".git/$lock" ]; then
    rm -f ".git/$lock" && echo "Cleared stale lock: .git/$lock"
  fi
done
# stale per-ref locks (e.g. refs/heads/main.lock)
find .git/refs -name '*.lock' -type f -print -delete 2>/dev/null | sed 's/^/Cleared stale lock: /' || true

MSG="${1:-Scaffold Granite \"Ask the Oracle\" portal (brand-by-domain, query + learn, BHR rebuttal excluded)}"

echo "Repo:   $(git remote get-url origin)"
echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
echo

git add -A

if git diff --cached --quiet; then
  echo "Nothing to commit — working tree already matches the last commit."
else
  git commit -m "$MSG"
fi

echo
echo "Pushing to origin/main ..."
git push -u origin main

echo
echo "Done. View it at: https://github.com/saeis-prog/Granite"
