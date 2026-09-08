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

printf '[setup] done.\n'
