#!/usr/bin/env bash
# Stop hook: warn if .claude/rules/ or docs/adr/ files were changed but
# aegis_sync_docs / aegis_import_doc was likely not called.
#
# Detection: scan the conversation transcript for aegis_sync_docs or
# aegis_import_doc tool calls. If absent and the diff touches those dirs,
# emit a non-blocking warning so the agent remembers to sync.

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

CHANGED=$(git diff --name-only HEAD 2>/dev/null || true)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null || true)
ALL_FILES=$(printf '%s\n%s' "$CHANGED" "$UNTRACKED" | sort -u)

RULES_CHANGED=$(printf '%s' "$ALL_FILES" | grep -c '^\(\.claude/rules/\|docs/adr/\)' || true)

if [ "$RULES_CHANGED" -eq 0 ]; then
  exit 0
fi

INPUT=$(cat)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)

AEGIS_CALLED=false
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  if grep -q '"aegis_sync_docs\|aegis_import_doc"' "$TRANSCRIPT" 2>/dev/null; then
    AEGIS_CALLED=true
  fi
fi

if [ "$AEGIS_CALLED" = true ]; then
  exit 0
fi

jq -n '{
  systemMessage: "⚠️ Aegis sync check: .claude/rules/ or docs/adr/ files were modified but aegis_sync_docs / aegis_import_doc was not detected in this session. Run aegis_sync_docs (for edits) or aegis_import_doc (for new files) to keep the knowledge base current."
}'

exit 0
