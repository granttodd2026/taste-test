#!/bin/sh
# Deploy dist/ to GitHub Pages (gh-pages branch). Requires an explicit approval flag. Never run without the requester's OK via the CoS.
# Usage: APPROVED=1 DEPLOY_REPO=https://github.com/<owner>/<repo>.git scripts/deploy.sh
set -eu
[ "${APPROVED:-}" = "1" ] || { echo "Refusing: set APPROVED=1 only after the OK is given."; exit 1; }
: "${DEPLOY_REPO:?set DEPLOY_REPO}"
git diff --quiet && git diff --cached --quiet || { echo "Refusing: working tree not clean."; exit 1; }
npm run gate
VER=$(cat dist/version.txt)
TMP=$(mktemp -d); git clone -q -b gh-pages "$DEPLOY_REPO" "$TMP"
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r dist/. "$TMP"/
(cd "$TMP" && git add -A && git commit -qm "deploy $VER" && git push -q origin gh-pages)
git tag -a "v$(node -p "require('./package.json').version")" -m "release $VER" 2>/dev/null || true
echo "Deployed $VER. Verify: curl -s <site>/version.txt"
