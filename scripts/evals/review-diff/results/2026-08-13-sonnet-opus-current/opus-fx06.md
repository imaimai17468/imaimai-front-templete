Review complete. Project gates run: `tsc --noEmit` (clean), `bunx oxlint --type-aware` (clean), `bunx oxfmt --check` (clean) on the changed file. (Note: I first ran `bunx biome check` and it reported a tab/space "error" — the repo has no biome config and uses oxlint/oxfmt per `lefthook.yml:7-12`, so that output was a default-config artifact and I discarded it.)

```
{
  effort: "standard",
  findings: [],
  stats: { candidates: 5, refuted: 5 }
}
```

Stage C verdicts (all REFUTED, with the `file:line` re-read for each):

1. **Module-init / TDZ risk in the new module-scope constant** — `ProfileForm.tsx:34` evaluates `MAX_AVATAR_BYTES / 1024 / 1024` at module-evaluation time instead of at render/handler time. REFUTED: `src/lib/storage/avatar-validation.ts:101` is a top-level `const` bound to a literal expression, and that module (`avatar-validation.ts:1-157`) has no imports at all, so it cannot participate in a cycle with `ProfileForm.tsx`; ESM evaluates the dependency before the importer's body, so the binding is always initialized when line 34 runs.
2. **Value/output drift** — the interpolated text could differ. REFUTED: `avatar-validation.ts:101` is `5 * 1024 * 1024`, so `5242880 / 1024 / 1024 === 5` exactly (integer, no float artifact), and both call sites (`ProfileForm.tsx:75`, `ProfileForm.tsx:150`) interpolate the same expression the removed inline arithmetic produced. Rendered strings are byte-identical.
3. **Naming: `MAX_AVATAR_MB` holds MiB, not MB** — 1024-based division. REFUTED as a finding: the user-facing wording "MB" at `ProfileForm.tsx:75,150` is unchanged from before the diff, so the constant name matches the existing message vocabulary; flagging it here would be a true-but-immaterial remark on a behavior-identical extraction.
4. **Placement: derived constant belongs in `src/lib/storage/avatar-validation.ts` next to `MAX_AVATAR_BYTES`** — REFUTED per `.claude/rules/react.md` "Module Organization / Colocation over classification" and "Cross-feature sharing has two homes": the value is consumed only by `ProfileForm.tsx:75,150` (no other reference), and the lib home is prescribed for *shared* non-component values. Colocation in the consuming file is the correct home; moving it would also add an export knip would treat as surface.
5. **React purity of a module-scope computed value** — REFUTED against `.claude/rules/react.md` "React Purity": `ProfileForm.tsx:34` is a one-time read of an imported number with no mutation, no timing/call-count dependence, and no observation of the outside world; render at `ProfileForm.tsx:150` only reads it.

One thing for you, not a finding: the briefing said "a repeated **validation message** was extracted to a named constant". What the diff actually extracts is the repeated byte→MB **computation**; the two strings stay distinct (`"Please keep file size under …MB"` vs `"Click to change image (max …MB)"`) and are not shared. Worth wording the commit message after the code rather than the briefing.
