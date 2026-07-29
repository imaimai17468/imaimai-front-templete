#!/usr/bin/env bash
# PostToolUse(mcp__aegis__aegis_compile_context) hook (ADR-0013):
# 1. Create .claude/.aegis-stamp — the deterministic artifact the
#    pre-agent-aegis-guard keys on (cleared per prompt by user-prompt-gate.sh).
# 2. Near-miss warning:
# When the aegis_compile_context response contains glob_no_match near_miss_edges,
# cross-match those patterns against target_files using bash `[[ ]]` glob
# matching (extglob).
# Inject an additionalContext warning only for patterns that bash matches but
# Aegis reports as glob_no_match (suspicious — likely an Aegis glob bug).
#
# Decision logic:
#   A) Pattern matches a target_file via bash `[[ ]]` glob matching
#      → Divergence between Aegis and bash glob implementations = suspicious (confirmed bug)
#   B) bash also does not match → routine no-match → skip
#   C) reason is command_mismatch → always skip
#
# Output:
#   - 0 suspicious entries → exit 0 (silent)
#   - 1-3 entries → full list
#   - 4+ entries → first 3 + "and N more" abbreviation

set -euo pipefail
# macOS ships bash 3.2, which has neither `mapfile` nor `globstar`. Under
# `set -e` an unknown shopt name aborts the script — and this line sits above
# the stamp below, so the gate artifact was never created on such a machine and
# every non-exempt `Agent` dispatch was blocked (the four pinned review agents
# are exempt in pre-agent-aegis-guard.sh, which is why the review pipeline kept
# working and this stayed invisible from 4ff5e81 until 2026-07-29). The options
# are therefore requested, not required.
shopt -s extglob nullglob 2>/dev/null || true
# `globstar` was in that list and is deliberately gone. It governs pathname
# expansion, while the cross-check below matches with `[[ str == pattern ]]`,
# where a `*` already spans `/`. Verified on bash 3.2.57, where the option does
# not exist at all: `[[ a/b/c/index.ts == a/**/index.ts ]]` matches, and so does
# the same test with a single `*`. Setting it would change nothing here, and the
# comment claiming otherwise sent a reviewer looking for a bug that was not one.

INPUT=$(cat)

# Pass through when tool_response is absent or reports an error — an attempted
# consultation must not stamp the dispatch gate (ADR-0013).
TOOL_RESPONSE=$(printf '%s' "$INPUT" | jq -r 'if .tool_response then "present" else "absent" end' 2>/dev/null || true)
if [ "${TOOL_RESPONSE:-absent}" = "absent" ]; then
  exit 0
fi
# tool_response may be an object ({isError, content}) or a bare array of
# content blocks (MCP delivery shape) — indexing an array with .isError is a
# jq error, which the fail-closed fallback would misread as a failed
# consultation. Treat ONLY the known array shape as success; any other
# non-object shape (bare string/number/bool) is unknown territory and stays
# fail-closed (no stamp), per ADR-0013. Note: for the array shape the
# near-miss warning below no-ops (debug_info is not reachable on that
# shape) — the stamp is the load-bearing part.
RESPONSE_ERROR=$(printf '%s' "$INPUT" | jq -r '.tool_response | if type == "object" then (.isError // .is_error // false) elif type == "array" then false else true end' 2>/dev/null || echo true)
if [ "$RESPONSE_ERROR" != "false" ]; then
  exit 0
fi

# --- 1. Aegis gate stamp (ADR-0013) ---
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
touch "$ROOT/.claude/.aegis-stamp"

# Extract target_files into an array. Written as a read loop rather than
# `mapfile`, which bash 3.2 does not have — and this runs after the stamp, so a
# failure here would surface as a hook error on an otherwise successful gate.
# No blank-line filter: `mapfile -t` keeps an empty line as an empty element, so
# skipping them would make the count differ from the builtin this replaces.
TARGET_FILES=()
while IFS= read -r LINE; do
  TARGET_FILES+=("$LINE")
done < <(printf '%s' "$INPUT" | jq -r '.tool_input.target_files // [] | .[]' 2>/dev/null || true)

# Extract near_miss_edges that are glob_no_match and not command_mismatch
NEAR_MISS_JSON=$(printf '%s' "$INPUT" | jq -c '
  .tool_response.debug_info.near_miss_edges // []
  | map(select(.reason == "glob_no_match"))
' 2>/dev/null || true)

EDGE_COUNT=$(printf '%s' "$NEAR_MISS_JSON" | jq 'length' 2>/dev/null || true)

if [ -z "$EDGE_COUNT" ] || [ "$EDGE_COUNT" -eq 0 ]; then
  exit 0
fi

# Pass through when target_files is empty
if [ "${#TARGET_FILES[@]}" -eq 0 ]; then
  exit 0
fi

# Collect suspicious near_miss entries
SUSPICIOUS_ITEMS=()

while IFS= read -r EDGE; do
  PATTERN=$(printf '%s' "$EDGE" | jq -r '.pattern // ""')
  DOC_ID=$(printf '%s' "$EDGE" | jq -r '.target_doc_id // "unknown"')

  if [ -z "$PATTERN" ]; then
    continue
  fi

  # Test each target_file against the pattern using bash `[[ ]]` glob matching
  MATCHED=false
  for TARGET in "${TARGET_FILES[@]}"; do
    # shellcheck disable=SC2053
    if [[ "$TARGET" == $PATTERN ]]; then
      MATCHED=true
      break
    fi
  done

  if [ "$MATCHED" = "true" ]; then
    SUSPICIOUS_ITEMS+=("  - pattern: ${PATTERN} → doc_id: ${DOC_ID}")
  fi
done < <(printf '%s' "$NEAR_MISS_JSON" | jq -c '.[]' 2>/dev/null || true)

SUSPICIOUS_COUNT="${#SUSPICIOUS_ITEMS[@]}"

if [ "$SUSPICIOUS_COUNT" -eq 0 ]; then
  exit 0
fi

# Build the warning message
if [ "$SUSPICIOUS_COUNT" -le 3 ]; then
  LIST=$(printf '%s\n' "${SUSPICIOUS_ITEMS[@]}")
  SUFFIX=""
else
  LIST=$(printf '%s\n' "${SUSPICIOUS_ITEMS[0]}" "${SUSPICIOUS_ITEMS[1]}" "${SUSPICIOUS_ITEMS[2]}")
  REMAINING=$(( SUSPICIOUS_COUNT - 3 ))
  SUFFIX="
  ...and ${REMAINING} more (see debug_info.near_miss_edges for the full list)"
fi

CONTEXT="[Aegis near_miss_edges warning] The following edge_hints match target_files under bash \`[[ ]]\` glob matching but are reported as glob_no_match by Aegis. This is likely an Aegis glob implementation bug. Report via \`aegis_observe({event_type: \"compile_miss\", ...})\` or fix the glob pattern in the admin surface (aegis_import_doc / edge edit).

Affected edge_hints:
${LIST}${SUFFIX}"

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
