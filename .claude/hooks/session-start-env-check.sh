#!/usr/bin/env bash
# SessionStart hook: environment validation.
#
# The enforcement stack assumes tools that not every machine has (similarity-ts
# binary, node). Gates that silently skip a missing dependency create
# sessions whose guarantees differ by machine with no signal. This hook makes the
# degrade visible at session start.
#
set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
# CLAUDE_PROJECT_DIR is where the session started, and the input's `cwd` is the
# checkout the session works in; in a worktree session those differ, so the
# checks on the checkout itself read `cwd` first.
TREE="$ROOT"
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)"
  [ -n "$CWD" ] && [ -d "$CWD" ] && TREE="$CWD"
fi

MISSING=()

command -v jq >/dev/null 2>&1 || MISSING+=("jq (ALL guard hooks parse their input with jq — the gates are effectively OFF)")
command -v bun >/dev/null 2>&1 || MISSING+=("bun (the Stop quality gate, its markdown dead-link check, and lefthook's pre-commit/pre-push checks cannot run)")
# PATH only, matching the condition lefthook's similarity stage skips on: a
# binary the hook cannot invoke is absent as far as the gate is concerned, so
# accepting ~/.cargo/bin here would report a skipped check as present.
command -v similarity-ts >/dev/null 2>&1 || MISSING+=("similarity-ts not on PATH (lefthook pre-push skips duplicate-type/function detection; install: cargo install similarity-ts, and put ~/.cargo/bin on PATH)")
# `mise`, not `actionlint` or `shellcheck`: lefthook runs both static checks
# through `mise exec --` and skips each on a missing mise, so mise is the
# condition that decides whether they run. mise.toml pins the versions it
# resolves.
command -v mise >/dev/null 2>&1 || MISSING+=("mise not on PATH (lefthook pre-push skips the GitHub Actions workflow check and the shellcheck run; install: https://mise.jdx.dev/, then mise install)")
# The installed hooks, not the binary: `bun run setup` writes them through
# `lefthook install`, and a tree whose hooks are absent runs no pre-commit check
# while every binary above is present. Resolved through git because in a linked
# worktree `.git` is a file and the hooks live in the main checkout's
# .git/hooks. `--git-path` answers relative to the checkout when the hooks are
# inside it, so the test runs there.
( cd "$TREE" 2>/dev/null && [ -f "$(git rev-parse --git-path hooks/pre-commit 2>/dev/null)" ] ) || MISSING+=("lefthook hooks not installed — pre-commit/pre-push run nothing (fix: bun run setup)")
# A fresh worktree has no node_modules until someone installs; the Stop gate,
# the link check and lefthook all fail without it.
[ -d "$TREE/node_modules" ] || MISSING+=("node_modules absent — fresh checkout or worktree (fix: bun run setup)")
# A capability probe, not a version compare: what old node lacks is
# `module.registerHooks`, which @cloudflare/vite-plugin imports at module top
# level, so loading vite.config.ts fails wherever it is loaded. Observed on
# node 22.14: `bun run build` exits 1, while knip prints "Error loading
# vite.config.ts" and still exits 0 — CI's knip step loses its vite-config
# analysis with no failing exit code to show for it.
node -e 'if (typeof require("node:module").registerHooks !== "function") process.exit(1)' >/dev/null 2>&1 || MISSING+=("node with module.registerHooks — see engines in package.json (vite build fails; knip still exits 0 but cannot analyze vite.config.ts)")

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "[env-check] This session runs DEGRADED — missing gate dependencies:"
  printf '  - %s\n' "${MISSING[@]}"
  echo "[env-check] Per AGENTS.md 'Degraded Environments': state the degrade to the user once, and do not treat skipped checks as passed."
else
  echo "[env-check] Gate dependencies present (jq, bun, similarity-ts, mise, node with module.registerHooks, lefthook hooks installed, node_modules)."
fi

# SessionStart is the only hook event that receives `model`, and it is optional;
# mid-session switches fire no hook at all, so this reports the session start.
MODEL=""
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  MODEL="$(printf '%s' "$INPUT" | jq -r '.model // empty' 2>/dev/null)"
fi
if [ -n "$MODEL" ]; then
  echo "[env-check] Session model: $MODEL"
else
  echo "[env-check] Session model not reported by the harness."
fi

exit 0
