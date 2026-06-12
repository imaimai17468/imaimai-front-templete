#!/usr/bin/env bash
# Stop hook: warn if docs/adr/ files were changed but the
# Aegis knowledge base was likely not updated.
#
# Detection: scan the conversation transcript for aegis_sync_docs,
# aegis_import_doc, or share-materialize (source-native lane: update
# aegis-share/source/ then materialize). If absent and the diff touches those
# dirs, emit a non-blocking warning so the agent remembers to sync.

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

CHANGED=$(git diff --name-only HEAD 2>/dev/null || true)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null || true)
ALL_FILES=$(printf '%s\n%s' "$CHANGED" "$UNTRACKED" | sort -u)

RULES_CHANGED=$(printf '%s' "$ALL_FILES" | grep -c '^docs/adr/' || true)

if [ "$RULES_CHANGED" -eq 0 ]; then
  exit 0
fi

INPUT=$(cat)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)

AEGIS_CALLED=false
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  if grep -q 'aegis_sync_docs\|aegis_import_doc\|share-materialize' "$TRANSCRIPT" 2>/dev/null; then
    AEGIS_CALLED=true
  fi
fi

if [ "$AEGIS_CALLED" = true ]; then
  exit 0
fi

jq -n '{
  systemMessage: "⚠️ Aegis sync check: docs/adr/ files were modified but no knowledge-base update was detected in this session. Sync the matching aegis-share/source/documents/*.md body, then run `share-format` -> `share-lint` -> `share-materialize` -> `share-export` with `npx -y @fuwasegu/aegis@<pin in .mcp.json>` (preferred), or use aegis_sync_docs / aegis_import_doc."
}'

exit 0
