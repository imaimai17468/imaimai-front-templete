#!/usr/bin/env bash
# SessionStart hook: environment validation.
#
# The enforcement stack assumes tools that not every machine has (similarity-ts
# binary, python3, node). Gates that silently skip a missing dependency create
# sessions whose guarantees differ by machine with no signal. This hook makes the
# degrade visible at session start.
#
set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"

MISSING=()

command -v jq >/dev/null 2>&1 || MISSING+=("jq (ALL guard hooks parse their input with jq — the gates are effectively OFF)")
command -v bun >/dev/null 2>&1 || MISSING+=("bun (the Stop quality gate and lefthook's pre-commit/pre-push checks cannot run)")
[ -x "$HOME/.cargo/bin/similarity-ts" ] || command -v similarity-ts >/dev/null 2>&1 || MISSING+=("similarity-ts (Stop gate skips duplicate-type/function detection; install: cargo install similarity-ts)")
command -v python3 >/dev/null 2>&1 || MISSING+=("python3 (Stop gate skips the markdown dead-link check; the gate-behaviour test scripts under scripts/ cannot run either)")
# A capability probe, not a version compare: what old node lacks is
# `module.registerHooks`, which @cloudflare/vite-plugin imports at module top
# level, so loading vite.config.ts fails wherever it is loaded. Observed on
# node 22.14: `bun run build` exits 1, while knip prints "Error loading
# vite.config.ts" and still exits 0 — the Stop gate's knip layer loses its
# vite-config analysis with no failing exit code to show for it.
node -e 'if (typeof require("node:module").registerHooks !== "function") process.exit(1)' >/dev/null 2>&1 || MISSING+=("node with module.registerHooks — see engines in package.json (vite build fails; knip still exits 0 but cannot analyze vite.config.ts)")

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "[env-check] This session runs DEGRADED — missing gate dependencies:"
  printf '  - %s\n' "${MISSING[@]}"
  echo "[env-check] Per AGENTS.md 'Degraded environments': state the degrade to the user once, and do not treat skipped checks as passed."
else
  echo "[env-check] Gate dependencies present (jq, bun, similarity-ts, python3, node with module.registerHooks)."
fi

# Model continuity (AGENTS.md): surface the session model so a
# non-strongest parent is visible from turn one. SessionStart is the only
# hook event that receives `model`, and it is optional; mid-session model
# switches fire no hook at all — this check catches session start only.
MODEL=""
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  MODEL="$(printf '%s' "$INPUT" | jq -r '.model // empty' 2>/dev/null)"
fi
if [ -n "$MODEL" ]; then
  echo "[env-check] Session model: $MODEL"
  case "$(printf '%s' "$MODEL" | tr '[:upper:]' '[:lower:]')" in
    *fable*) : ;;
    *) echo "[env-check] Parent model is not the strongest tier — AGENTS.md 'Model continuity (non-Fable parent)' applies: escalate design judgment, verify more. Mid-session model switches are NOT detectable by hooks; re-check /model if in doubt." ;;
  esac
else
  echo "[env-check] Session model not reported by the harness. If this session is not on the strongest available model, AGENTS.md 'Model continuity (non-Fable parent)' applies."
fi

exit 0
