# fx-02
base: d343489dccc9f8e3c4b692259a51608d20134aee

## Expected findings
- file: src/components/features/profile-page/profile-form/ProfileForm.tsx
  nature: banned `as` type assertion added on the updateProfileFn result —
  AGENTS.md "Never escape the type system" (only `as const` is allowed);
  the rule must be cited.
  severity-floor: minor

## Acceptable extras
- none
