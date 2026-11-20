#!/usr/bin/env bash
# SessionStart hook: environment validation.
#
# The enforcement stack assumes tools that not every machine has (mise, node).
# Gates that silently skip a missing dependency create sessions whose guarantees
# differ by machine with no signal. This hook makes the degrade visible at
# session start.
#
set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../../.." && pwd)}"
# CLAUDE_PROJECT_DIR is where the session started, and the input's `cwd` is the
# checkout the session works in; in a worktree session those differ, so the
# checks on the checkout itself read `cwd` first.
TREE="$ROOT"
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)"
  [ -n "$CWD" ] && [ -d "$CWD" ] && TREE="$CWD"
fi

STRICT=0
if [ "${1:-}" = "--strict" ]; then
  STRICT=1
fi

GATE=()
SETUP=()
CREATED=()

command -v jq >/dev/null 2>&1 || GATE+=("jq (ALL guard hooks parse their input with jq — the gates are effectively OFF)")
command -v bun >/dev/null 2>&1 || GATE+=("bun (the Stop quality gate and lefthook's pre-commit/pre-push checks cannot run)")
# `mise`, not `actionlint` or `shellcheck`: lefthook runs both static checks
# through `mise exec --` and skips each on a missing mise, so mise is the
# condition that decides whether they run. mise.toml pins the versions it
# resolves.
if command -v mise >/dev/null 2>&1; then
  if ! ( cd "$TREE" 2>/dev/null && mise exec -- actionlint --version >/dev/null 2>&1 ); then
    GATE+=("mise tools not ready — actionlint unavailable via mise exec (fix: mise install; if paranoid mode: mise trust mise.toml)")
  fi
else
  GATE+=("mise not on PATH (lefthook pre-push skips the GitHub Actions workflow check and the shellcheck run; install: https://mise.jdx.dev/, then mise install)")
fi
# The installed hooks, not the binary: `bun run setup` writes them through
# `lefthook install`, and a tree whose hooks are absent runs no pre-commit check
# while every binary above is present. Resolved through git because in a linked
# worktree `.git` is a file and the hooks live in the main checkout's
# .git/hooks. `--git-path` answers relative to the checkout when the hooks are
# inside it, so the test runs there.
( cd "$TREE" 2>/dev/null && [ -f "$(git rev-parse --git-path hooks/pre-commit 2>/dev/null)" ] ) || GATE+=("lefthook hooks not installed — pre-commit/pre-push run nothing (fix: bun run setup)")
# A fresh worktree has no node_modules until someone installs; the Stop gate
# and lefthook both fail without it.
[ -d "$TREE/node_modules" ] || GATE+=("node_modules absent — fresh checkout or worktree (fix: bun run setup)")
# The void CLI checks the same floor when it starts and exits naming it, and
# `bun run dev`, `bun run build` and `bun run smoke` all start it.
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit((major === 24 && minor >= 22) || (major === 26 && minor >= 12) || major > 26 ? 0 : 1)' >/dev/null 2>&1 || GATE+=("node 24.22+ or 26.12+ (the void CLI exits under an older node; fix: mise install, which reads mise.toml)")

# Gitignored, so a fresh checkout has none, and a worktree gets one only where
# the main checkout already had one. `-L` sits beside `-e` because `-e` follows
# a symlink: a dangling one reads as absent, and the copy would then write
# through it to a path outside the tree. The copy runs from inside the tree so
# `cp` names the two files the way the entries below name theirs.
LOCAL_ENV=.env
PLACEHOLDERS=scripts/setup/placeholders.dotenv
if [ -e "$TREE/$LOCAL_ENV" ] || [ -L "$TREE/$LOCAL_ENV" ]; then
  [ -f "$TREE/$LOCAL_ENV" ] || SETUP+=("$LOCAL_ENV exists and is not a regular file (fix: remove that path, and the next session copies $PLACEHOLDERS in its place)")
elif CP_ERROR="$( ( cd "$TREE" && cp "$PLACEHOLDERS" "$LOCAL_ENV" ) 2>&1 )"; then
  CREATED+=("Created $LOCAL_ENV from $PLACEHOLDERS, whose values are placeholders (edit them before pointing the tree at a real service).")
else
  SETUP+=("$LOCAL_ENV absent, and copying $PLACEHOLDERS to it failed (fix: restore $PLACEHOLDERS, or make the checkout writable). cp said: ${CP_ERROR:-cp exited non-zero and printed nothing}")
fi
# The void plugin refuses to start while any other dotenv file sits at the
# root, so each one found is named here. Only names are listed, never a value.
for OTHER_ENV in "$TREE"/.env.* "$TREE"/.dev.vars*; do
  [ -e "$OTHER_ENV" ] || continue
  SETUP+=("${OTHER_ENV##*/} at the root stops bun run dev (fix: move its values into $LOCAL_ENV, then remove it)")
done
[ -f "$TREE/.void/tsconfig.json" ] || SETUP+=(".void/tsconfig.json absent, so the type check cannot resolve void/env, void/db or @schema (fix: bun run setup, or bun run generate-void)")
[ -f "$TREE/src/routeTree.gen.ts" ] || SETUP+=("src/routeTree.gen.ts absent (fix: bun run setup, or bun run generate-routes)")

if [ "${#CREATED[@]}" -gt 0 ]; then
  printf '[env-check] %s\n' "${CREATED[@]}"
fi

ISSUES=$(( ${#GATE[@]} + ${#SETUP[@]} ))
if [ "$ISSUES" -gt 0 ]; then
  if [ "${#GATE[@]}" -gt 0 ]; then
    echo "[env-check] This session runs DEGRADED — missing gate dependencies:"
    printf '  - %s\n' "${GATE[@]}"
    echo "[env-check] Per AGENTS.md 'Degraded Environments': state the degrade to the user once, and do not treat skipped checks as passed."
  fi
  if [ "${#SETUP[@]}" -gt 0 ]; then
    echo "[env-check] Checkout setup incomplete:"
    printf '  - %s\n' "${SETUP[@]}"
  fi
else
  echo "[env-check] Gate dependencies and checkout setup look complete."
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

if [ "$STRICT" = 1 ] && [ "$ISSUES" -gt 0 ]; then
  exit 1
fi
exit 0
