# Web Security Audit

A skill for source-first, defensive security review of a codebase. By default it gives guidance and does focused reviews. It runs the full six-phase audit, which writes `findings.json`, a coverage ledger, and a report, only when the request asks for a full audit, a pen test, or a report artifact. `SKILL.md`'s Operating modes section decides which mode a request gets.

## Layout

- `SKILL.md`: the entry point. It holds the operating modes, the full audit setup, and the six phases.
- `references/`: the phase procedures (`RECONNAISSANCE.md`, `HUNTING.md`, `VALIDATION-AND-REPORTING.md`), the attack-class index (`ATTACK-CLASSES.md`), one companion file per target domain, and `report-schema.json`, the schema every `findings.json` record follows.
- `scripts/`: `validate-findings.cjs` and `validate-coverage-ledger.cjs`, which an audit runs on its own output, and their `node:test` suites.

## Validating an audit's output

```sh
node scripts/validate-findings.cjs <output-dir>/findings.json
node scripts/validate-coverage-ledger.cjs <output-dir>/coverage-ledger.json
```

## Testing the validators

```sh
node --test scripts/*.test.cjs
```
