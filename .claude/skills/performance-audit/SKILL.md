---
name: performance-audit
description: Run performance traces (Core Web Vitals — LCP, CLS, INP) across all pages, analyze insights, record results in docs/lighthouse/performance/, then fix issues found.
when_to_use: When the user asks for performance audit, page speed check, Core Web Vitals measurement, LCP/CLS/INP optimization, or wants to verify performance after changes.
argument-hint: "[page-path (optional)]"
arguments: path
---

# Performance Audit

Run performance traces across the application, analyze Core Web Vitals, record results, and fix issues.

## Current git context

!`git log --oneline -1`

## Procedure

### 1. Build and start preview server

Performance must be measured against a production build, not the dev server.

1. Check `package.json` for the build and preview scripts
2. Run the build script to create a production build
3. Start the preview server
4. Confirm the preview server is running and note the URL/port
5. If the preview port is occupied, kill the existing process first

### 2. Verify the app is working

1. Navigate to the top page and take a screenshot
2. Confirm the page renders correctly (no error screens, no "Something went wrong")
3. Check console messages for server errors (500 etc.)
4. If the app has authentication, confirm the user is logged in — if not, ask the user to log in before proceeding

Do not start tracing until the app is confirmed working.

### 3. Determine audit targets

If `$path` is provided, trace only that page.

Otherwise, discover all navigable pages by:
1. Checking the sitemap or router config for defined routes
2. Falling back to crawling links from the top page

Classify each as:
- Public (no auth required)
- Auth-gated (skip if not logged in, note "skipped (auth required)")

For parameterized routes, pick the first available item.

### 4. Run traces

For each target page:

1. Navigate using `mcp__chrome-devtools__navigate_page`
2. Run `mcp__chrome-devtools__performance_start_trace` with `reload: true`, `autoStop: true`
3. Review the returned insights summary — note available insight sets and their IDs
4. For each insight that has findings, drill down with `mcp__chrome-devtools__performance_analyze_insight` to get details (especially `LCPBreakdown`, `DocumentLatency`, `CLSCulprits`, `RenderBlocking`, `SlowCSS`)
5. Collect Core Web Vitals scores: LCP (ms), CLS, INP (ms)

### 5. Write report

Create/update `docs/lighthouse/performance/YYYY-MM-DD.md`:

```markdown
# Performance Audit Report — YYYY-MM-DD

Commit: `{short hash}` {commit message}

## Summary

| Page | LCP (ms) | CLS | INP (ms) | Rating |
|------|----------|-----|----------|--------|
| ... | ... | ... | ... | Good/Needs Improvement/Poor |

Rating thresholds (web.dev):
- LCP: Good < 2500, Poor > 4000
- CLS: Good < 0.1, Poor > 0.25
- INP: Good < 200, Poor > 500

## Insights

### {Page}

#### LCP Breakdown

- Element: {LCP element description}
- TTFB: {ms}
- Resource load: {ms}
- Render delay: {ms}

#### Render-Blocking Resources

- {resource}: {duration}ms blocked

#### Layout Shifts (CLS)

- {element}: shifted by {score}
  - Cause: {reason}

#### Other Findings

- **{insight-name}**: {description}
  - Impact: {severity}
  - Fix: {suggestion}

(If a category has no issues, write "No issues found.")
```

### 6. Compare with previous

If a previous report exists in `docs/lighthouse/performance/`, compare metrics. Note regressions (LCP increased by 500ms+, CLS increased by 0.05+) or improvements under `## Changes from previous audit`.

### 7. Fix issues

After writing the report, fix performance issues in priority order:

1. **Render-blocking resources** — defer or async-load scripts/styles
2. **LCP optimization** — preload LCP element, reduce server response time, optimize images
3. **CLS fixes** — add explicit dimensions to images/embeds, avoid dynamic content insertion above the fold
4. **Long tasks / INP** — break up long tasks, debounce event handlers, use `startTransition` for non-urgent updates

After fixes are applied, rebuild and restart the preview server before re-tracing. Update the report with "after fix" metrics.
