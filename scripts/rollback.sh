#!/bin/sh
# Roll back to a previous tagged release. DRY RUN by default; pass --yes only with the CoS's OK.
# Usage: scripts/rollback.sh v1.2.3 [--yes]
set -eu
TAG=${1:?usage: rollback.sh vX.Y.Z [--yes]}
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || { echo "no such tag $TAG"; exit 1; }
WT=$(mktemp -d); git worktree add -q "$WT" "$TAG"
( cd "$WT" && npm ci --silent && npm run build --silent && npm test --silent )
echo "Built + tested $TAG in $WT/dist"
if [ "${2:-}" = "--yes" ]; then (cd "$WT" && ./scripts/deploy.sh); else echo "DRY RUN: would deploy $TAG. Re-run with --yes after approval."; fi
git worktree remove --force "$WT"
