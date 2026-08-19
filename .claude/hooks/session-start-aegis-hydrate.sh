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
# Runner: prefer bunx - this repo's package manager (package.json
# "packageManager") and faster to start than npx. Both resolve the same pinned
# package, so only startup cost differs. npx is the fallback for environments
# without bun (AGENTS.md, "Degraded Environments").
if command -v bunx >/dev/null 2>&1; then
  AEGIS="bunx @fuwasegu/aegis@${VER}"
else
  AEGIS="npx -y @fuwasegu/aegis@${VER}"
fi

if [ ! -f .aegis/aegis.db ]; then
  echo "[aegis-hydrate] No local Aegis DB - rebuilding it from the aegis-share bundle..."
  HYDRATE_OUT=$($AEGIS share-hydrate 2>&1)
  HYDRATE_STATUS=$?
  printf '%s\n' "$HYDRATE_OUT" | tail -8
  if [ "$HYDRATE_STATUS" -ne 0 ]; then
    echo "[aegis-hydrate] share-hydrate FAILED (exit $HYDRATE_STATUS). The knowledge base is still empty - run manually: $AEGIS share-hydrate"
    exit 0
  fi
  echo "[aegis-hydrate] Done. Note for the agent: no documents are file-anchored (ADR-0021), so aegis_sync_docs is a no-op here - doctor's remaining signal is bundle-vs-DB drift, not anchor drift."
  exit 0
fi

DOCTOR_OUT=$($AEGIS doctor 2>&1)
if [ $? -ne 0 ]; then
  echo "[aegis-hydrate] Aegis doctor reports an actionable state:"
  printf '%s\n' "$DOCTOR_OUT" | tail -6
  # bundle_newer must be handled BEFORE any materialize/export: those derive the
  # exported version from the local DB, so running them against a behind DB
  # rewrites the tracked bundle at the OLDER version (silent history regression).
  # doctor suggests plain `share-hydrate`, which fails on an initialized DB.
  if printf '%s' "$DOCTOR_OUT" | grep -q 'bundle_newer'; then
    echo "[aegis-hydrate] The tracked bundle is AHEAD of the local DB. Do NOT run share-materialize/share-export first - that would re-export the bundle at the local (older) version and regress it. Correct order: 1) $AEGIS share-hydrate --replace (WARNING: drops local observations/proposals/compile_log - check them first via aegis_list_observations / aegis_workspace_status), 2) only then run the share pipeline if you changed source/documents/."
  else
    echo "[aegis-hydrate] If source/documents/ changed, run: $AEGIS share-format && $AEGIS share-lint && $AEGIS share-materialize && $AEGIS share-export"
    echo "[aegis-hydrate] If nothing changed (e.g. right after share-hydrate): nothing to do - no documents are file-anchored (ADR-0021)."
  fi
fi

exit 0
