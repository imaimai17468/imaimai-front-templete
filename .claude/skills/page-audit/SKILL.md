---
name: page-audit
description: Measure every page with Lighthouse (accessibility, SEO, best practices) and a Core Web Vitals trace (LCP, CLS, INP), record the results in docs/lighthouse/, then fix what they find. Use when the user asks for an accessibility, a11y, SEO, Lighthouse, performance, page-speed, or Core Web Vitals audit.
argument-hint: "[page-path (optional)]"
arguments: path
---

# Page audit

Both measurements target a production build, because a dev-server number is not the one
users get. Where nothing serves one, step 1 says what a `bun run dev` run still settles and
what it does not.

## 1. Serve a production build

Read the build and preview scripts from `package.json`, build, start the preview server and
note its URL. Where `package.json` has no preview script, nothing serves the production build
locally: ask the user for a deployed URL, and until they name one measure `bun run dev`
instead, which settles accessibility, SEO and CLS because those read the rendered DOM rather
than the bundle. Name that environment at the top of the report, keep its LCP and INP out of
`## Best so far`, and hold the production build's size to the targets in step 7 from
`bun run build` alone. If the port is occupied, kill the holder (`lsof -ti:<port> | xargs kill`)
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
   `SlowCSS`), collecting LCP, CLS and INP. The trace carries no interaction unless you
   add one, so a page without one has no INP and its cell says `—`.

Where the MCP server answers that its browser profile is already running, another session
holds it: run the same tools through the `chrome-devtools` CLI after
`chrome-devtools start --isolated=true`. On 2026-10-15 that CLI's trace with `--reload true`
recorded `about:blank`, and starting with `--reload false --autoStop false`, reloading with
`navigate_page <id> --type reload`, then `performance_stop_trace` recorded the page.

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
- {page} · {device} · {metric}: {regression | new best | reset | misses target | beats target}, {best} → {this audit}, {what changed on the page, for a reset}

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

## 7. Hold each page to the targets

Step 6 protects what an earlier audit reached. These targets are what every page is held to
on top of that, so a page that has never been better than them is still a finding. They were
set from what the 2026-10-15 baseline in `docs/lighthouse/` measured, and the row marked
provisional waits for the first production-build run. web.dev
(https://web.dev/articles/vitals, read 2026-10-15) calls a page good at LCP within 2.5 s, INP
of 200 ms or less and CLS of 0.1 or less, each at the 75th percentile of page loads, and a
target below those numbers is set only where a measurement already sits under it.

| Metric | Target | Why this number |
|---|---|---|
| Accessibility | 100 on a production-build run | After the 2026-10-15 fixes the only failing audit left was `target-size` on the dev-only react-grab toolbar, which the production build does not ship |
| SEO | 100 | Measured 100 once the description meta landed |
| Best practices | 100 | Measured 100 on every page |
| LCP | ≤ 1000 ms (provisional) | Set from dev-server LCP of 45 to 65 ms, which the paragraph below does not accept for LCP; every page's LCP is text the server renders, so an edge round trip and the stylesheet are what production adds. The first production-build audit confirms or replaces it |
| CLS | ≤ 0.02 | Measured 0.00 on every page, and 0.1 is five times that margin |
| INP | ≤ 200 ms | web.dev's good threshold, kept until an audit measures one, because the trace carries no interaction |
| Largest client chunk | < 500 kB minified | Vite's `build.chunkSizeWarningLimit` default, so `bun run build` prints no chunk warning; 601 kB before the split, 328 kB after |
| Scripts every page loads | ≤ 250 kB gzip | The entry's chunks (`index`, `react`, `effect`, `utils`) total 207 kB gzip after the split |

Read the two chunk rows from `bun run build`'s `dist/client/assets/` with the production build,
and the rest from step 4's runs against the production build. A dev-server run settles only
accessibility, SEO and CLS, and an audit that fails only on an element the dev build alone
ships, such as the react-grab toolbar, is named in the page's section rather than counted
against the target.

A page that misses a target is a finding for step 8 whether or not step 6 called it a
regression. Fix it in this audit where the fix is in reach, and otherwise write it under
`## Changes` as `misses target: {metric} {value} against {target}, {cause}`, so the next audit
still sees it. A value that beats its target by more than step 6's margin goes under
`## Changes` as `beats target: {metric} {value} against {target}`, which is what the next
tightening of this table is set from; the audit that measures it leaves the table itself
alone.

## 8. Fix, then re-measure

In priority order: render-blocking resources (defer or async-load), LCP (preload the
element, cut server response time, optimize images), CLS (explicit dimensions, nothing
inserted above the fold), long tasks and INP (split the tasks, debounce handlers,
`startTransition` for non-urgent updates). Where the shift arrives as data lands,
give the skeleton the dimensions of the content it stands in for. Fix a shift recorded
after LCP ahead of one before it of the same size, because the later one moves content the
user is already reading.
Rebuild and restart whichever server step 1 settled on before re-measuring, add the after-fix numbers
to the same report, and update `## Best so far` from them as step 6 says, so the fix
becomes the value the next audit is held to, with step 7's targets as the floor under it.
