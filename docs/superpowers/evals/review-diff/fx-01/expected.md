# fx-01
base: d343489dccc9f8e3c4b692259a51608d20134aee

## Expected findings
- file: src/entities/user/index.ts
  nature: UpdateUserSchema accepts an empty name — min(0) contradicts the
  "Name is required" message and the required-name contract.
  severity-floor: minor

## Acceptable extras
- src/entities/user/index.test.ts branch coverage for the min boundary not
  updated (white-box testing rule).
