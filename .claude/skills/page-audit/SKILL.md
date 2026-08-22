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

1. `mcp__chrome-devtools__navigate_page`
2. `mcp__chrome-devtools__lighthouse_audit` with `mode: "navigation"`, once per
   `device: "desktop"` and `device: "mobile"`, collecting the accessibility, SEO and
   best-practices scores with their violations
3. `mcp__chrome-devtools__performance_start_trace` with `reload: true`, `autoStop: true`,
   then `mcp__chrome-devtools__performance_analyze_insight` on every insight that reported
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
- **CLS**: {element} shifted {score}, cause {…}
- **Render-blocking**: {resource} blocked {ms}
```

A page with nothing to report says so in one line. Ratings (web.dev): LCP good < 2500, poor
> 4000; CLS good < 0.1, poor > 0.25; INP good < 200, poor > 500.

## 6. Compare with the previous report

Against the newest earlier file in `docs/lighthouse/`, list regressions and improvements
under `## Changes`. A regression is a Lighthouse score down 5 or more, LCP up 500ms or
more, or CLS up 0.05 or more.

## 7. Fix, then re-measure

In priority order: render-blocking resources (defer or async-load), LCP (preload the
element, cut server response time, optimize images), CLS (explicit dimensions, nothing
inserted above the fold), long tasks and INP (split the tasks, debounce handlers,
`startTransition` for non-urgent updates). Rebuild and restart the preview server before
re-measuring, and add the after-fix numbers to the same report.
