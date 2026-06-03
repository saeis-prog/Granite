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
