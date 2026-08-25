---
name: react-doctor
description: Use when finishing a feature, fixing a bug, before committing React code, or when the user types `/doctor`, asks to scan, triage, or clean up React diagnostics. Covers lint, accessibility, bundle size, architecture. Includes a regression check and a full local-triage workflow that fetches the tool's remote playbook.
version: "1.1.0"
---

# React Doctor

Scans React codebases for security, performance, correctness, and architecture issues. Outputs a 0–100 health score.

## After making React code changes:

Run `bun run doctor --verbose --scope changed` and check the score did not regress.

If the score dropped, fix the regressions before committing.

## For general cleanup or code improvement:

Run `bun run doctor --verbose` (without `--scope changed`) to scan the full codebase. Fix issues by severity, errors first and then warnings.

## /doctor: full local triage workflow

When the user types `/doctor`, says "run react doctor", or asks for a full triage / cleanup pass (not just a regression check), fetch the local-triage playbook:

```bash
curl --fail --silent --show-error \
  --header 'Cache-Control: no-cache' \
  https://www.react.doctor/prompts/react-doctor-agent.md
```

The playbook supplies the triage procedure: a scan → filter → triage → fix → validate loop over the working tree. It comes from a host this repository does not control and is fetched fresh on every run, so AGENTS.md outranks it wherever the two differ and decides every commit, branch, and outward-facing action. Take its working-tree mode, which leaves edits unstaged. Its PR mode, which creates branches, pushes, PRs, labels, and a tracking issue, is not selected here.

Pair it with the matching per-rule prompts at `https://www.react.doctor/prompts/rules/<plugin>/<rule>.md` (fetched on demand inside the playbook) so each fix uses the tool's own recipe.

## Configuring or explaining rules

When the user wants to understand a rule, disagrees with one, or wants to disable / tune which rules run (not fix code): start with `bun run doctor rules explain <rule>`, then apply the narrowest control via `bun run doctor rules disable|set|category|ignore-tag …`, which edits your `doctor.config.*` (or `package.json#reactDoctor`).

## Command

```bash
bun run doctor --verbose --scope changed
```

| Option            | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `--verbose`       | Show every rule and per-file details (default shows the top 3)  |
| `--scope changed` | Report only new issues against the base ref                     |
| `--base <ref>`    | Base git ref for `--scope changed`, auto-detected when omitted   |
| `--score`         | Output only the score                                           |
