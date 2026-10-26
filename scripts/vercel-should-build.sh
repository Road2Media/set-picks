#!/usr/bin/env bash
# Vercel Ignored Build Step (wired from vercel.json ignoreCommand).
# Exit 0 → skip deploy; exit 1 → build.
#
# Skips previews for dependency/CI-only PRs that do not touch SPA artifacts.

set -euo pipefail

# Every Dependabot ref skips the preview (#1148). Root npm groups only change
# the lockfile, and a rebase used to force a new preview because the tip was
# always that lockfile commit. The staging deploy after merge is the Vercel
# check that still runs. Actions-only and functions-only refs are included.
case "${VERCEL_GIT_COMMIT_REF:-}" in
  dependabot/*) exit 0 ;;
esac

# Build only when SPA-relevant paths changed vs parent commit.
if git diff HEAD^ HEAD --quiet -- \
  package.json \
  package-lock.json \
  src/ \
  public/ \
  api/ \
  vite.config.js \
  vercel.json \
  index.html
then
  exit 0
fi

exit 1
