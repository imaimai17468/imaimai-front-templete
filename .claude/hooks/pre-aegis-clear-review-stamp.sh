#!/usr/bin/env bash
# PreToolUse(aegis_compile_context): clear .review-stamp on new implementation cycle.

set -euo pipefail

cat > /dev/null

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
rm -f "$ROOT/.claude/.review-stamp"
