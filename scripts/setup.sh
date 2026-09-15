#!/usr/bin/env bash
# Prepares a fresh checkout or worktree for `bun run check`, `bun run test` and
# its first push.
set -Eeuo pipefail

cd "${0%/*}/.."

STEP=""
trap 'printf "[setup] failed at: %s\n" "$STEP" >&2' ERR

run() {
  STEP="$*"
  printf '[setup] %s\n' "$STEP"
  "$@"
}

# `mise trust` is the one step that needs a binary the other steps do not, so a
# machine without mise runs the rest instead of stopping here.
if command -v mise >/dev/null 2>&1; then
  run mise trust mise.toml
else
  printf '[setup] mise not on PATH: skipped trusting mise.toml.\n'
fi

run bun install --frozen-lockfile
# `bun install` on bun 1.3.1 leaves the root package's `prepare` unrun, so the
# git hooks it installs are written here instead.
run bun run prepare
run bun run generate-routes
run bun run cf-typegen

# The local env file is gitignored, so a fresh clone has none and a worktree
# gets one only where the main checkout already had one. `-L` sits beside `-e`
# because `-e` follows a symlink: a dangling one reads as absent, and the copy
# would then write through it to a path outside the tree.
if [ -f .env.local ]; then
  printf '[setup] .env.local already exists: skipped copying .env.local.example.\n'
elif [ -e .env.local ] || [ -L .env.local ]; then
  # The steps above did their work, so the exit reports the one thing this run
  # could not prepare rather than sending the reader back through all of them.
  # An explicit exit leaves the ERR trap unfired, so no step is named as failing.
  printf '[setup] .env.local exists and is not a regular file: remove that path, then setup copies .env.local.example in its place.\n' >&2
  exit 1
else
  run cp .env.local.example .env.local
  printf '[setup] .env.local holds placeholder values: edit them before pointing the tree at a real service.\n'
fi

printf '[setup] done.\n'
