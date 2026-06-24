#!/usr/bin/env bash
# PostToolUse hook: sync .aegis/aegis.db changes to aegis-share/ after
# aegis_sync_docs or aegis_import_doc. This is the DB -> aegis-share direction;
# the reverse (aegis-share -> DB) is handled by session-start-aegis-hydrate.sh.

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

[ -d aegis-share/source ] || exit 0

VER=$(sed -n 's/.*"@fuwasegu\/aegis@\([0-9][0-9.]*\)".*/\1/p' .mcp.json | head -1)
if [ -z "$VER" ]; then
  jq -n '{systemMessage: "[aegis-share-sync] Could not parse @fuwasegu/aegis version from .mcp.json - skipping share sync."}'
  exit 0
fi
AEGIS="npx -y @fuwasegu/aegis@${VER}"

STEPS=("share-format" "share-lint" "share-materialize" "share-export")
for step in "${STEPS[@]}"; do
  OUT=$($AEGIS "$step" 2>&1)
  RC=$?
  if [ $RC -ne 0 ]; then
    printf '%s' "$OUT" | jq -Rs --arg step "$step" \
      '{systemMessage: ("[aegis-share-sync] " + $step + " failed. Fix manually: npx -y @fuwasegu/aegis@<ver> " + $step + "\n\n" + .)}'
    exit 0
  fi
done

jq -n '{systemMessage: "[aegis-share-sync] aegis-share/ synced successfully (format -> lint -> materialize -> export)."}'
exit 0
