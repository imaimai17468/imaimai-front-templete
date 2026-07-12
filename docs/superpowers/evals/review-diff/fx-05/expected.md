# fx-05 (delta scenario)
base: d343489dccc9f8e3c4b692259a51608d20134aee

## Expected findings
- file: src/entities/user/index.ts
  nature: max(500) contradicts its own "at most 50 characters" message (and
  the 50-character product limit) — limit/message mismatch.
  severity-floor: minor

## Acceptable extras
- src/entities/user/index.test.ts branch coverage for the max boundary not
  updated (white-box testing rule).

## Delta-mode dispatch inputs (Phase 2)
- prior report: `prior-report.md` in this directory, verbatim.
- delta description: "one edit to src/entities/user/index.ts adjusting the
  UpdateUserSchema name max-length rule and its message".
- Phase 1 baseline runs this fixture as a FULL review (no prior report).
