Confirmed: this is a pure, module-level constant extraction with no behavioral change.

```
{
  "effort": "standard",
  "findings": [],
  "stats": { "candidates": 3, "refuted": 3 }
}
```

**Stage A candidates (all refuted in Stage C):**

1. **Float-division / value drift concern** — `MAX_AVATAR_MB = MAX_AVATAR_BYTES / 1024 / 1024` (`ProfileForm.tsx:34`). Re-read `src/lib/storage/avatar-validation.ts:101`: `export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;`. Division yields exactly `5` before and after the change — identical output at both call sites (`ProfileForm.tsx:79`, `ProfileForm.tsx:150`, re-read post-edit). REFUTED — no behavior change.

2. **Module-order/TDZ concern** — new top-level `const` at `ProfileForm.tsx:34` depends on the imported `MAX_AVATAR_BYTES` (`ProfileForm.tsx:22`). Re-read `ProfileForm.tsx:1-34`: the const is declared after the import statement in source order, and ES module imports are resolved/bound before the importing module's own top-level statements execute, so `MAX_AVATAR_BYTES` is available when `MAX_AVATAR_MB` is computed. REFUTED — no initialization-order hazard.

3. **Incomplete extraction / duplication** — `src/server/fn/profile.ts:41` contains the same `MAX_AVATAR_BYTES / 1024 / 1024` expression, not migrated to a shared constant. Re-read `git diff HEAD`: that file is not part of the uncommitted diff (pre-existing code, untouched). Per scope, this is not "the file is in the diff," so it's legitimately out of scope for this review, and it's a trivial style point on an already-benign, behavior-identical refactor. REFUTED as an actionable finding — out of scope and immaterial (would only be worth raising if the intent were "eliminate all duplicates," which the stated intent is not).

**Verification files/lines opened:** `ProfileForm.tsx:1-34, 72-78, 147-150`, `src/lib/storage/avatar-validation.ts:101`, `src/server/fn/profile.ts:41` (via grep + targeted read).

No AGENTS.md/`.claude/rules/` violations found — `react.md` (hooks/purity) not implicated (no hook or render-purity change), `design.md` not implicated (no CSS/markup change). Diff scope confirmed via `git status` + `git diff HEAD` + `git ls-files --others --exclude-standard` (no untracked files). This is a clean, behavior-identical refactor; findings are correctly zero per the Stage A calibration note for benign diffs.
