---
name: lighthouse-audit
description: Run Lighthouse audits (a11y, SEO, best practices) across all pages for desktop and mobile, then record results in docs/lighthouse/audit/.
when_to_use: When the user asks for accessibility audit, a11y check, SEO audit, Lighthouse audit, or wants to verify UI quality after changes.
argument-hint: "[page-path (optional)]"
arguments: path
---

# Lighthouse Audit

Run Lighthouse audits across the application and record results.

## Current git context

!`git log --oneline -1`

## Procedure

### 1. Verify dev server

Confirm the dev server is running on the framework's default port. If the port is occupied, kill the existing process with `lsof -ti:<port> | xargs kill` before starting. Do not fall back to a different port.

### 2. Determine audit targets

If `$path` is provided, audit only that page (both desktop and mobile).

Otherwise, discover all navigable pages by:
1. Checking the sitemap or router config for defined routes
2. Falling back to crawling links from the top page

Classify each as:
- Public (no auth required)
- Auth-gated (skip if not logged in, note "skipped (auth required)")

For parameterized routes, pick the first available item.

### 3. Run audits

For each target page:

1. Navigate using `mcp__chrome-devtools__navigate_page`
2. Run `mcp__chrome-devtools__lighthouse_audit` with `mode: "navigation"` for:
   - `device: "desktop"`
   - `device: "mobile"`
3. Collect scores and violations for all three categories

### 4. Write report

Create/update `docs/lighthouse/audit/YYYY-MM-DD.md`:

```markdown
# Lighthouse Audit Report — YYYY-MM-DD

Commit: `{short hash}` {commit message}

## Summary

| Page | Device | Accessibility | SEO | Best Practices |
|------|--------|--------------|-----|----------------|
| ... | Desktop | ... | ... | ... |
| ... | Mobile | ... | ... | ... |

## Violations

### {Page} ({Device})

#### Accessibility

- **{rule-id}**: {description} — {count} elements
  - Impact: {critical/serious/moderate/minor}
  - Fix: {suggestion}

#### SEO

- **{rule-id}**: {description}
  - Fix: {suggestion}

#### Best Practices

- **{rule-id}**: {description}
  - Fix: {suggestion}

(If a category has no violations, write "No issues found.")
```

### 5. Compare with previous

If a previous report exists in `docs/lighthouse/audit/`, compare scores. Note regressions (score dropped by 5+) or improvements under `## Changes from previous audit`.
