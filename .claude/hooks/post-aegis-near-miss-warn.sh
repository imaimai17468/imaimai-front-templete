#!/usr/bin/env bash
# PostToolUse(mcp__aegis__aegis_compile_context) hook:
# When the aegis_compile_context response contains glob_no_match near_miss_edges,
# cross-match those patterns against target_files using bash extglob + globstar.
# Inject an additionalContext warning only for patterns that bash matches but
# Aegis reports as glob_no_match (suspicious — likely an Aegis glob bug).
#
# Decision logic:
#   A) Pattern matches a target_file via bash extglob + globstar
#      → Divergence between Aegis and bash glob implementations = suspicious (confirmed bug)
#   B) bash also does not match → routine no-match → skip
#   C) reason is command_mismatch → always skip
#
# Output:
#   - 0 suspicious entries → exit 0 (silent)
#   - 1-3 entries → full list
#   - 4+ entries → first 3 + "and N more" abbreviation

set -euo pipefail
shopt -s extglob globstar nullglob

INPUT=$(cat)

# Pass through when tool_response is absent
TOOL_RESPONSE=$(printf '%s' "$INPUT" | jq -r 'if .tool_response then "present" else "absent" end' 2>/dev/null || true)
if [ "${TOOL_RESPONSE:-absent}" = "absent" ]; then
  exit 0
fi

# Extract target_files into an array
mapfile -t TARGET_FILES < <(printf '%s' "$INPUT" | jq -r '.tool_input.target_files // [] | .[]' 2>/dev/null || true)

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

  # Test each target_file against the pattern using bash extglob + globstar
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

CONTEXT="[Aegis near_miss_edges warning] The following edge_hints match target_files in bash (extglob + globstar) but are reported as glob_no_match by Aegis. This is likely an Aegis glob implementation bug. Report via \`aegis_observe({event_type: \"compile_miss\", ...})\` or fix the glob pattern in the admin surface (aegis_import_doc / edge edit).

Affected edge_hints:
${LIST}${SUFFIX}"

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
