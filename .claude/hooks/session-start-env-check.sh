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

MISSING=()

command -v jq >/dev/null 2>&1 || MISSING+=("jq (ALL guard hooks parse their input with jq — the gates are effectively OFF)")
command -v bun >/dev/null 2>&1 || MISSING+=("bun (the Stop quality gate, its markdown dead-link check, and lefthook's pre-commit/pre-push checks cannot run)")
# PATH only, matching the condition lefthook's similarity stage skips on: a
# binary the hook cannot invoke is absent as far as the gate is concerned, so
# accepting ~/.cargo/bin here would report a skipped check as present.
command -v similarity-ts >/dev/null 2>&1 || MISSING+=("similarity-ts not on PATH (lefthook pre-push skips duplicate-type/function detection; install: cargo install similarity-ts, and put ~/.cargo/bin on PATH)")
# The installed hooks, not the binary: `bun run prepare` writes them, and a tree
# whose .git/hooks are absent runs no pre-commit check while every binary above
# is present.
[ -f "$ROOT/.git/hooks/pre-commit" ] || MISSING+=("lefthook hooks not installed — pre-commit/pre-push run nothing (fix: bun run prepare)")
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
  echo "[env-check] Per AGENTS.md 'Degraded environments': state the degrade to the user once, and do not treat skipped checks as passed."
else
  echo "[env-check] Gate dependencies present (jq, bun, similarity-ts, node with module.registerHooks, lefthook hooks installed)."
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
