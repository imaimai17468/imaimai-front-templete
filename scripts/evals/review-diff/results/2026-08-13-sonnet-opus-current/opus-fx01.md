## Review report

```
{
  "effort": "standard",
  "findings": [
    {
      "file": "src/entities/user/index.ts",
      "line": 28,
      "title": "`.min(0)` removes the required check — empty profile names now pass validation, while the copy still says \"Name is required\"",
      "description": "Zod's `.min(0)` asserts `length >= 0`, which is true for every string, so the constraint is a no-op and its message is unreachable. Failure scenario: a user clears the Name field and submits ProfileForm; `zodResolver(UpdateUserSchema)` raises no error, `ProfileForm.tsx:100` appends `\"\"` to the FormData, `updateProfileFn`'s validator (`src/server/fn/profile.ts:15`) parses it successfully, and `updateUser` persists an empty name. Because `server/fn/` is the authorization/validation boundary, there is no second guard behind it. The UI degrades quietly rather than visibly (`ProfileForm.tsx:112` renders the fallback \"User\"), so the data corruption is silent. The change is also self-contradictory as shipped: the retained message \"Name is required\" now describes a rule the schema no longer enforces, so whichever intent was meant, the current state is wrong. The briefing's claim that validation and the boundary message were adjusted together does not hold — only the validation changed; the message text is untouched in the diff.",
      "severity": "critical",
      "verdict": "CONFIRMED",
      "verification": "Re-read src/entities/user/index.ts:25-30 (constraint and message), src/server/fn/profile.ts:11-16 (parse is the only server-side guard), src/components/features/profile-page/profile-form/ProfileForm.tsx:52 and :100 (resolver and submit path), :112 (empty-name display fallback). Executed `npx vitest run src/entities/user/index.test.ts`: `safeParse({ name: \"\" })` returned no error (`result.error?.issues[0]?.message` → undefined), directly demonstrating the empty string is accepted.",
      "fix": "This needs a one-line decision from the repository owner, because the diff states two incompatible intents. Recommended option A (restore the invariant): change `src/entities/user/index.ts:28` back to `.min(1, \"Name is required\")`. This is the shape the rest of the code already assumes — the message, the test at `index.test.ts:24-27`, and the fact that `server/fn/` is the sole validation boundary. Option B (empty names are deliberately allowed): delete the `.min(...)` call entirely rather than leaving `.min(0)` (a constraint that can never fail is dead code and its message is a lie), and in the same commit update `src/entities/user/index.test.ts:24-27` to assert `safeParse({ name: \"\" }).success === true` and rename the test at line 14. Do not keep `.min(0, \"Name is required\")` under either option. Pick A unless the owner confirms empty names are an intended product state.",
      "acceptance": "`src/entities/user/index.ts` contains either `.min(1, \"Name is required\")` (option A) or no `.min` on `name` at all (option B) — never `.min(0, ...)`; and `npx vitest run src/entities/user/index.test.ts` passes with the test file consistent with the chosen option."
    },
    {
      "file": "src/entities/user/index.test.ts",
      "line": 24,
      "title": "Existing test suite fails on this diff — the empty-name case is now red",
      "description": "\"should return the required message when the name is empty\" asserts `result.error?.issues[0]?.message === \"Name is required\"`. With `.min(0)` there is no error, so the optional chain yields `undefined` and the assertion fails. Committing the diff as-is breaks the test suite and CI. AGENTS.md \"Verification before completion\" forbids reporting done with a failing check, and the file is directly coupled to the diff, so this is not dismissible as pre-existing.",
      "severity": "critical",
      "verdict": "CONFIRMED",
      "verification": "Re-read src/entities/user/index.test.ts:13-35. Ran `npx vitest run src/entities/user/index.test.ts`: 1 failed | 9 passed — `AssertionError: expected undefined to be 'Name is required'` at index.test.ts:26.",
      "fix": "Resolved by whichever option is chosen for the finding above — no independent fix. Option A restores the test to green untouched; option B requires editing `src/entities/user/index.test.ts:24-27` to assert success on the empty string and renaming the line-14 test so it no longer claims a minimum length of 1. Do not silence this by deleting the test.",
      "acceptance": "`npx vitest run src/entities/user/index.test.ts` reports 10 passed, 0 failed."
    }
  ],
  "stats": { "candidates": 4, "refuted": 1 }
}
```

**Refuted (for transparency):** the test title at `src/entities/user/index.test.ts:14` (\"minimum length of 1\") was raised as drift — refuted at `index.test.ts:14-16`: the assertion (`name: \"a\"` accepted) holds under both candidate fixes, and under option A the title is exactly correct. Minor naming noise, not actionable on its own.

The 50/51-character boundary was re-derived at `index.test.ts:18-22, 29-34` and is unaffected — both max-length assertions passed in the run above.
