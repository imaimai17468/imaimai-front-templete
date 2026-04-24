#!/usr/bin/env bash
# Fail only on vulnerabilities in direct dependencies.
# Transitive vulns are shown as informational (not blocking) since we cannot
# patch them without `overrides`, which add template debt — the template
# treats direct deps as the audit boundary and relies on upstream for the rest.
set -euo pipefail

DIRECT=$(jq -r '((.dependencies // {}) + (.devDependencies // {})) | keys | .[]' package.json | sort -u)
VULN_JSON=$(bun audit --json 2>/dev/null || true)
VULN_PKGS=$(printf '%s' "$VULN_JSON" | jq -r 'keys | .[]' | sort -u)

if [ -z "$VULN_PKGS" ]; then
  echo "✅ No vulnerabilities found."
  exit 0
fi

DIRECT_VULNS=$(comm -12 <(printf '%s\n' "$DIRECT") <(printf '%s\n' "$VULN_PKGS") || true)

if [ -n "$DIRECT_VULNS" ]; then
  echo "⛔ Vulnerabilities in direct dependencies:"
  printf '%s\n' "$DIRECT_VULNS"
  echo ""
  echo "Full audit output:"
  bun audit || true
  exit 1
fi

echo "ℹ️  Transitive-only vulnerabilities (not blocking):"
printf '%s\n' "$VULN_PKGS" | sed 's/^/  - /'
echo ""
echo "✅ No direct-dependency vulnerabilities."
