# fx-03
base: d343489dccc9f8e3c4b692259a51608d20134aee

## Expected findings
- file: src/components/shared/header/user-menu/UserMenu.tsx
  nature: Math.random() called during render — violates react.md purity
  (idempotent render); the label changes on every re-render. The react.md
  rule (or Rules of React purity) must be referenced.
  severity-floor: minor

## Acceptable extras
- none
