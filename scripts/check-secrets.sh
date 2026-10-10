#!/bin/sh
# Fails if anything that looks like a secret is tracked, built, or in git history. Prints file:line only, never the value.
set -u
PAT='((VAPID_PRIVATE|SERVER_SK|PRIVATE_?KEY|SECRET)["'"'"']?\s*[:=]\s*["'"'"'][A-Za-z0-9_+/=-]{20,}|BEGIN [A-Z ]*PRIVATE KEY|#k=[A-Za-z0-9_-]{20,}|nsec1[0-9a-z]{20,}|gh[pousr]_[A-Za-z0-9]{20,})'
fail=0
if git rev-parse --git-dir >/dev/null 2>&1; then
  hits=$(git grep -nIE "$PAT" -- . ':!scripts/check-secrets.sh' ':!*.md' | cut -d: -f1,2)
else
  echo "(not a git repo yet: scanning files)"; hits=$(grep -rnIE "$PAT" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=check-secrets.sh --exclude='*.md' . | cut -d: -f1,2)
fi
# History CONTENT, not just filenames: every commit on every ref. Prints commit:file:line only, never the value.
if git rev-parse --git-dir >/dev/null 2>&1 && [ -n "$(git rev-list --all | head -1)" ]; then
  hh=$(git grep -nIE "$PAT" $(git rev-list --all) -- . ':!scripts/check-secrets.sh' ':!*.md' 2>/dev/null | cut -d: -f1-3 | sort -u)
  [ -n "$hh" ] && { echo "Secret-like strings in git history:"; echo "$hh" | cut -c1-12,41- ; fail=1; }
  echo "history: scanned $(git rev-list --all | wc -l | tr -d ' ') commits"
fi
[ -n "$hits" ] && { echo "Secret-like strings in tracked files:"; echo "$hits"; fail=1; }
if [ -d dist ]; then dh=$(grep -rnIE "$PAT" dist | cut -d: -f1,2); [ -n "$dh" ] && { echo "Secret-like strings in dist/:"; echo "$dh"; fail=1; }; fi
git rev-parse --git-dir >/dev/null 2>&1 && for f in .secrets.json sender/.secrets.json FAMILY_LINK.txt .env; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 && { echo "TRACKED secret file: $f"; fail=1; }
  git log --all --format= --name-only | grep -qx "$f" && { echo "Secret file in git history: $f"; fail=1; }
done
[ $fail = 0 ] && echo "secrets: PASS" || { echo "secrets: FAIL"; exit 1; }
