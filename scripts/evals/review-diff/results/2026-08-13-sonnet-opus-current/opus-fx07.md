## Review report

```json
{
  "effort": "standard",
  "findings": [
    {
      "file": "src/components/features/profile-page/profile-form/ProfileForm.tsx",
      "line": 92,
      "title": "Avatar upload failure now discards the pending file, so retry silently skips the upload",
      "description": "`setPendingFile(null)` was moved above the error check, so it runs on the failure path too. Scenario: user picks an image, submits, `uploadAvatarFn` returns `{ error: \"Not authenticated\" }` (or the gateway's error) — a returned value, not a throw, so line 92 has already executed. The toast shows and the handler returns, but `pendingFile` is now null while `previewUrl` is still set. Result: (a) the large avatar keeps showing the new image as if it were saved, (b) the \"New image selected. Click Update Profile to save.\" hint at line 153 disappears, and (c) pressing Update Profile again skips the `if (pendingFile)` branch entirely — the name is updated with a success toast while the image is never uploaded. Recovering requires re-picking the file, with no UI cue that this is necessary. Before the diff, `pendingFile` survived a failed upload and retry worked.",
      "severity": "major",
      "verdict": "CONFIRMED",
      "verification": "Re-read ProfileForm.tsx:86-97 (ordering of `setPendingFile(null)` vs the error early-return), :113 and :124 (`avatarUrl = previewUrl ?? user.avatarUrl` — preview persists independently of `pendingFile`), :153-157 (hint gated on `pendingFile`); src/server/fn/profile.ts:47-54 confirms `uploadAvatarFn` *returns* `{ error }` rather than throwing on the auth path, so the failure branch is reached with line 92 already applied.",
      "fix": "In `src/components/features/profile-page/profile-form/ProfileForm.tsx`, move `setPendingFile(null)` back below the error block, i.e. restore:\n```ts\nconst avatarResult = await uploadAvatarFn({ data: avatarData });\nif (\"error\" in avatarResult && avatarResult.error !== undefined) {\n  toast.error(avatarResult.error);\n  return;\n}\nsetPendingFile(null);\n```\nClear-on-success-only is the right shape because `pendingFile` *is* the retry token: it is the sole record of what still needs uploading, and the preview/hint UI is derived from it. The alternative — clearing early and also resetting `previewUrl` on failure — was considered and rejected: it makes the failure destroy the user's selection, which is worse UX and still loses the retry. This reverts the ProfileForm hunk entirely; the UserMenu rename is unaffected.",
      "acceptance": "`git diff HEAD -- src/components/features/profile-page/profile-form/ProfileForm.tsx` prints nothing (the file is back to HEAD), and in `onSubmit` the statement `setPendingFile(null);` appears after the closing brace of the `if (\"error\" in avatarResult ...)` block."
    },
    {
      "file": "src/components/shared/header/user-menu/UserMenu.tsx",
      "line": 21,
      "title": "Unrelated rename shares the working tree with a behavior change",
      "description": "The tree holds two independently revertible changes: a behavior-identical local rename in UserMenu.tsx and a control-flow change in ProfileForm.tsx. AGENTS.md \"Commits & Pull Requests\": one commit = one purpose; drive-by fixes are always a separate commit. Committing both together makes the behavior change harder to isolate or revert later. (Note: if the ProfileForm finding above is fixed by reverting that hunk, this resolves itself — only the rename remains.)",
      "severity": "minor",
      "verdict": "CONFIRMED",
      "rule": "AGENTS.md — Commits & Pull Requests: one commit = one purpose",
      "verification": "Re-read UserMenu.tsx:21 and :33 — `avatarSrc` is a function-local `const` used at exactly one site, with `?? undefined` unchanged, so the rename is provably behavior-identical and shares no purpose with the ProfileForm hunk (ProfileForm.tsx:92).",
      "fix": "Stage explicit paths rather than the whole tree: commit `src/components/shared/header/user-menu/UserMenu.tsx` on its own (`refactor` prefix), and the ProfileForm change separately if any of it survives. No code edit required.",
      "acceptance": "`git status --porcelain` shows the two files staged in separate commits — i.e. `git show --stat HEAD` after each commit lists exactly one file."
    }
  ],
  "stats": { "candidates": 4, "refuted": 2 }
}
```

**Refuted candidates (for transparency):**
- *`previewUrl` is not cleared when the upload fails* — REFUTED. Verified at ProfileForm.tsx:42-49 and :113: the object URL is released by the effect keyed on `previewUrl`, and with the fix applied the preview plus the `pendingFile` hint stay consistent (both say "selected, not yet saved"). Pre-existing and not a defect once retry is restored.
- *`avatarSrc` rename violates a naming rule* — REFUTED. Re-read `.claude/rules/react.md` "Generic component naming": the rule scopes to props of generic/reusable components, not function-local variables; `AvatarImage src=` already follows the platform convention at UserMenu.tsx:33.
