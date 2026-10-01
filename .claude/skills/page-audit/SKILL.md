---
name: page-audit
description: Measure every page with Lighthouse (accessibility, SEO, best practices) and a Core Web Vitals trace (LCP, CLS, INP), record the results in docs/lighthouse/, then fix what they find. Use when the user asks for an accessibility, a11y, SEO, Lighthouse, performance, page-speed, or Core Web Vitals audit.
argument-hint: "[page-path (optional)]"
arguments: path
---

# Page audit

Both measurements run against a production build. A dev-server number is not the one users
get.

## 1. Serve a production build

Read the build and preview scripts from `package.json`, build, start the preview server and
note its URL. If the port is occupied, kill the holder (`lsof -ti:<port> | xargs kill`)
rather than moving to another port.

## 2. Confirm the app works

Navigate to the top page, screenshot it, and read the console. Stop on an error screen or a
5xx. Where the app has authentication, confirm the session is live, and ask the user to log in
where it is not. Do not measure an app you have not seen render.

## 3. Pick the targets

With `$path`, audit that page alone. Otherwise take the routes from the router config,
falling back to crawling links from the top page. A parameterized route uses the first
available item. An auth-gated page you cannot reach is recorded as
`skipped (auth required)`, never silently dropped.

## 4. Measure each page

1. `mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page`
2. `mcp__plugin_chrome-devtools-mcp_chrome-devtools__lighthouse_audit` with `mode: "navigation"`, once per
   `device: "desktop"` and `device: "mobile"`, collecting the accessibility, SEO and
   best-practices scores with their violations
3. `mcp__plugin_chrome-devtools-mcp_chrome-devtools__performance_start_trace` with `reload: true`, `autoStop: true`,
   then `mcp__plugin_chrome-devtools-mcp_chrome-devtools__performance_analyze_insight` on every insight that reported
   findings (`LCPBreakdown`, `DocumentLatency`, `CLSCulprits`, `RenderBlocking`,
   `SlowCSS`), collecting LCP, CLS and INP

## 5. Write the report

`docs/lighthouse/YYYY-MM-DD.md`, opening with the commit it measured
(`git log --oneline -1`):

```markdown
# Page audit: YYYY-MM-DD
Commit: `{short hash}` {subject}

| Page | Device | A11y | SEO | Best practices | LCP (ms) | CLS | INP (ms) |
|---|---|---|---|---|---|---|---|

## {page}
- **{category} · {rule-id}**: {what, and how many elements} · impact {level} · fix {the change}
- **LCP**: element {…}, TTFB {ms}, resource load {ms}, render delay {ms}
- **CLS**: {element} in {region} shifted {score} {before LCP | after LCP}, cause {…}
- **Render-blocking**: {resource} blocked {ms}

## Changes
- {page} · {device} · {metric}: {regression | new best | reset}, {best} → {this audit}, {what changed on the page, for a reset}

## Best so far
| Page | Device | A11y | SEO | Best practices |
|---|---|---|---|---|

| Page | LCP (ms) | CLS |
|---|---|---|
```

`{region}` is the landmark element that contains the shifted element (`header`, `nav`,
`main`, `aside`, `footer`), or the nearest heading where no landmark does. The LCP and CLS
best values have no device column because step 4 takes them from one trace per page.

A page with nothing to report says so in one line. Ratings (web.dev): LCP good < 2500, poor
> 4000; CLS good < 0.1, poor > 0.25; INP good < 200, poor > 500.

## 6. Compare with the best so far

`## Best so far` holds the value each later audit is compared with, so a win stays protected
after the audit that made it. Copy both tables from the newest earlier file in
`docs/lighthouse/` and compare this audit's numbers with them. A page or device the tables
have no row for takes this audit's numbers as its row. The margins are a score 5 points,
LCP 500ms, and CLS 0.05:

- A regression is a value worse than its best by the margin or more.
- A new best is a value better than its best by the margin or more. Gains smaller than the
  margin still count once they add up past it, because each audit compares with the stored
  best rather than with the previous report.
- A value inside the margin in either direction is treated as run-to-run noise, and the
  cell stays as it is.

Lighthouse and the trace both vary between runs, so where a value crosses the margin, measure
that page again. A regression or a new best stands only where both runs cross the same
margin in the same direction; otherwise the cell stays and nothing goes under `## Changes`.
A new best records the worse of the two runs, because one lucky run would otherwise set a
best that a typical run misses by more than the margin. The page's row in the main table
takes the same run.

Where the page itself changed, such as new content above the fold, replace the cell with the
worse of two runs of this audit and say under `## Changes` what changed on the page. No
other case writes a value worse than the cell.

## 7. Fix, then re-measure

In priority order: render-blocking resources (defer or async-load), LCP (preload the
element, cut server response time, optimize images), CLS (explicit dimensions, nothing
inserted above the fold), long tasks and INP (split the tasks, debounce handlers,
`startTransition` for non-urgent updates). Where the shift arrives as data lands,
give the skeleton the dimensions of the content it stands in for. Fix a shift recorded
after LCP ahead of one before it of the same size, because the later one moves content the
user is already reading.
Rebuild and restart the preview server before re-measuring, add the after-fix numbers
to the same report, and update `## Best so far` from them as step 6 says, so the fix
becomes the value the next audit is held to.
