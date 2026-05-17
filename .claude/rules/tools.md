# Tools

- **tsgo**: Type checker. Run `bun run typecheck`.
- **oxlint**: Linter. Run `bun run lint`. Config: `.oxlintrc.json`.
- **oxfmt**: Formatter. Run `bun run format` to fix, `bun run format:check` to verify.
- **knip**: Detects unused dependencies, exports, and files. Run `bun run knip`. Config: `knip.json`.
- **similarity**: Detects duplicate/similar code. Run `similarity-ts ./src` to scan, add `--print` to show code, `--threshold <value>` to adjust sensitivity. Default threshold is `0.87`. Only findings at or above the threshold are reported. When the stop hook fires with similarity findings, evaluate the score: findings above `0.90` almost certainly indicate real duplication worth refactoring; findings between `0.87–0.90` may be structural coincidence — inspect before deciding.
- **wrangler types**: Generates `CloudflareEnv` from `wrangler.toml`. Run `bun run cf-typegen` after changing bindings. Output `worker-configuration.d.ts` is gitignored — regenerate locally; do not hand-edit.

## Stop hook response rules

### No infinite loops

When the stop hook reports the same findings repeatedly, do NOT keep responding "Pre-existing." That wastes tokens. After the second occurrence, move to actually fixing the issue.

### Assume your changes caused the finding

Do not dismiss stop hook findings as "pre-existing code issues." If the finding involves a file you modified, your change likely caused or surfaced it. Always address findings related to files you touched.

### Do not suppress with `similarity-ignore` / `@public`

Suppression comments are a last resort, not a first response. Fix the root cause: refactor duplicated code or delete unused code. Suppression is only acceptable when unification is structurally impossible (e.g., independent domain Containers sharing the same Dialog props interface).
