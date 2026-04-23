---
name: self-review
description: Final self-check before reporting work as "done". Coding-rule conformance is handled by the stop-agent-review hook and is intentionally out of scope here. This skill only hunts for (1) missing test coverage on new branches, (2) dead code / YAGNI / over-abstraction, and (3) suspicious bug patterns like null/undefined access and off-by-one. Invoke autonomously after multi-file implementations, added branches, or new file creation. Skip for one-line fixes, config-only edits, or docs-only changes.
---

# Self Review

The last self-check before declaring "done". **Role-split with the `stop-agent-review` hook**: this skill does *not* check coding-rule conformance (style / architecture / dependencies) — that's the hook's job. Leave it to the hook.

---

## When to invoke

**Invoke**:

- Multiple files edited or new files created
- A conditional branch was added (`if` / ternary / `switch` / guard clause)
- A new pure function was added
- A Container or Presenter was newly created

**Skip**:

- One-line fix / typo / comment-only change
- Config-only change (`package.json`, `*.json`, `*.toml`, `.gitignore`)
- Docs-only change (`*.md`)
- Already reviewed in the same turn

---

## The three lenses (and only these three)

### 1. Missing test coverage

For each added branch, new pure function, or new Presenter (whose output varies by props/state or that has a11y attributes), confirm a test exists and covers every branch.

- **Pure function**: always required. Same directory must have `*.test.ts` covering all branches.
- **Presenter**: must have tests if rendering varies by props/state, or if a11y attributes are present.
- **Container**: mock data fetching, verify the props passed to the Presenter.
- If a branch was added inside an existing test target, confirm a corresponding `it()` was added.

If anything is missing, add the test using the AAA + `"should [expected] when [condition]"` format from `.claude/rules/testing.md` before declaring done.

### 2. YAGNI / over-engineering / dead code

Re-read the diff against the principle in AGENTS.md — "bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper" — and look for anything added beyond what the task actually required.

Checklist:

- **Unused exports / functions / variables** (knip catches this later, but eyeball it here)
- **Helpers extracted for a single call site** — inline until the third occurrence
- **Error handling / fallbacks / validation for scenarios that can't happen** — trust internal code, validate only at boundaries
- **Back-compat shims, feature flags, `// removed` comments** — unnecessary insurance
- **Empty `try/catch`, swallow-catches**
- **Branches that can only take one path, or unreachable code**
- **Useless comments** (WHAT-describing comments). Keep only WHY, non-obvious invariants, or traps.

Delete or inline before declaring done.

### 3. Suspicious bug patterns

Not rule violations, but run-time fragility. `tsgo` (in the hook) catches type errors; this lens is for semantic bugs types can't see.

Checklist:

- **null / undefined access**: optional chaining / nullish coalescing missing? Could `data.items.map(...)` fail if `items` is undefined?
- **off-by-one**: `slice` / `substring` boundaries, pagination start indices, `length - 1` patterns
- **Array emptiness**: using `[0]` / `.find()` results without an undefined check
- **Missing `await`**: calling Promise-returning functions without awaiting (especially in `setInterval` / `useEffect` cleanup)
- **useEffect dependency arrays**: missing or excessive dependencies causing stale closures or re-render loops
- **Abused type assertions (`as`)**: unsafe casts that leave runtime failure modes open
- **Boundary values**: does the code survive 0, negative, empty array, empty string, max value inputs?

Fix or add a guard before declaring done.

---

## Procedure

1. Read the uncommitted diff with `git diff HEAD`. For any spot where the diff text alone isn't enough to judge (e.g., cleanup logic, dependency arrays, initial state), open the actual file with Read.
2. Re-read the diff through the three lenses above and note findings as bullet points internally. **Stay silent on lenses with no findings** — do not emit noise like "YAGNI: none".
3. If there are zero findings, report exactly `self-review: clean` and declare done.
4. If there are findings, fix them in priority order.
5. After fixing, run `bun run typecheck` and `bun run test` to confirm nothing broke. If something broke, return to step 4.
6. When reporting done, list the fixed items one per line.

**Output policy**: one line when clean. When findings exist, lead with "fixed N items" followed by a bullet list. Do not write long review logs — the diff speaks for itself.
