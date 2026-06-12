#!/usr/bin/env bash
# SessionStart hook: hydrate the local Aegis DB from aegis-share/source.
#
# .aegis/aegis.db is gitignored (local artifact); aegis-share/source/ is the
# canonical, git-tracked knowledge. Without this hook a fresh clone has an
# empty knowledge base and aegis_compile_context returns no documents.
#
# - DB missing       -> run share-hydrate automatically (rebuild from the
#                      committed bundle aegis-share/manifest.json+canonical.json)
# - DB present       -> run doctor; if it reports an actionable state (stale
#                      docs, bundle drift), emit a warning with the fix.

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

[ -d aegis-share/source ] || exit 0

# Keep the CLI version in lockstep with the MCP server pin in .mcp.json.
# Fail closed: never run an unpinned (latest) CLI.
VER=$(sed -n 's/.*"@fuwasegu\/aegis@\([0-9][0-9.]*\)".*/\1/p' .mcp.json | head -1)
if [ -z "$VER" ]; then
  echo "[aegis-hydrate] Could not parse the @fuwasegu/aegis version pin from .mcp.json - skipping (fix the pin to re-enable hydration)."
  exit 0
fi
AEGIS="npx -y @fuwasegu/aegis@${VER}"

if [ ! -f .aegis/aegis.db ]; then
  echo "[aegis-hydrate] No local Aegis DB - rebuilding it from the aegis-share bundle..."
  HYDRATE_OUT=$($AEGIS share-hydrate 2>&1)
  HYDRATE_STATUS=$?
  printf '%s\n' "$HYDRATE_OUT" | tail -8
  if [ "$HYDRATE_STATUS" -ne 0 ]; then
    echo "[aegis-hydrate] share-hydrate FAILED (exit $HYDRATE_STATUS). The knowledge base is still empty - run manually: $AEGIS share-hydrate"
    exit 0
  fi
  echo "[aegis-hydrate] Done. Note for the agent: call aegis_sync_docs once (admin surface) to re-anchor file-anchored docs - doctor reports them stale until then."
  exit 0
fi

DOCTOR_OUT=$($AEGIS doctor 2>&1)
if [ $? -ne 0 ]; then
  echo "[aegis-hydrate] Aegis doctor reports an actionable state:"
  printf '%s\n' "$DOCTOR_OUT" | tail -6
  echo "[aegis-hydrate] If docs/adr/ changed: sync aegis-share/source/documents/ to match, then run: $AEGIS share-format && $AEGIS share-lint && $AEGIS share-materialize && $AEGIS share-export"
  echo "[aegis-hydrate] If nothing changed (e.g. right after share-hydrate): call aegis_sync_docs once to re-anchor - stale warnings clear when content already matches."
fi

exit 0
