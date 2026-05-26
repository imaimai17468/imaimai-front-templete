# Tools

- **tsgo**: Type checker. Run `bun run typecheck`.
- **oxlint**: Linter. Run `bun run lint`. Config: `.oxlintrc.json`. Type-aware linting is enabled (`--type-aware` flag) — rules that require type information (e.g., `no-unsafe-type-assertion`, `no-unnecessary-template-expression`) are active.
- **oxfmt**: Formatter. Run `bun run format` to fix, `bun run format:check` to verify.
- **knip**: Detects unused dependencies, exports, and files. Run `bun run knip`. Config: `knip.json`.
- **similarity**: Detects duplicate/similar code. Run `similarity-ts ./src` to scan, add `--print` to show code, `--threshold <value>` to adjust sensitivity. Default threshold is `0.87`. Only findings at or above the threshold are reported. When the stop hook fires with similarity findings, evaluate the score: findings above `0.90` almost certainly indicate real duplication worth refactoring; findings between `0.87–0.90` may be structural coincidence — inspect before deciding.
- **wrangler types**: Generates `CloudflareEnv` from `wrangler.toml`. Run `bun run cf-typegen` after changing bindings. Output `worker-configuration.d.ts` is gitignored — regenerate locally; do not hand-edit.

## Database (Drizzle + D1)

- `bun run db:generate` — スキーマ変更後にマイグレーション SQL を生成する。
- `bun run db:push:local` — ローカル D1 をリセットし、全マイグレーションを適用する（`.wrangler/state` を削除して再構築）。スキーマ変更後はこれを実行すること。`sqlite3` で直接 ALTER しない。
- `bun run db:seed:local` — ローカル D1 にシードデータを投入する。`db:push:local` の後に実行。
- `bun run db:push` — リモート D1 にスキーマを push する（本番/ステージング用）。ローカル開発では使わない。
- `bun run db:studio` — Drizzle Studio を起動して DB を GUI で確認する。

スキーマ変更の典型的な流れ: `schema.ts` を編集 → `bun run db:generate` → `bun run db:push:local` → `bun run db:seed:local`。

## Dev Server

dev サーバーはフレームワークのデフォルトポートで起動すること。ポートが使用中の場合、別ポートへフォールバックさせず、`lsof -ti:<port>` で既存プロセスを kill してから起動する。

## Stop hook response rules

### No infinite loops

When the stop hook reports the same findings repeatedly, do NOT keep responding "Pre-existing." That wastes tokens. After the second occurrence, move to actually fixing the issue.

### Assume your changes caused the finding

Do not dismiss stop hook findings as "pre-existing code issues." If the finding involves a file you modified, your change likely caused or surfaced it. Always address findings related to files you touched.

### Similarity findings — fix or suppress?

Always try to fix first. `similarity-ignore` is a last resort.

**Fix (unify)**

| Case | Action |
|------|--------|
| Type duplication: multiple types share the same field set | Extract the common fields into a base type and compose with `&` |
| Type duplication: identical definition copied across files | Delete one copy and import from the remaining source |
| Function duplication: logic is identical, only argument types differ | Extract into a generic or shared utility function |

**Suppress (`similarity-ignore`)**

| Case | Reason |
|------|--------|
| Structural pattern match: `useState` + `setX(prev => ...)` + server call — the code "shape" is similar but the domain and processing are entirely different | Unifying would create an unnatural abstraction and hurt readability |
| Container/Presenter pattern: independent Containers pass the same props interface to their Presenter | Structural coincidence from the pattern; unifying would introduce unnecessary coupling between components |

Decision criterion: "If I unify these, would changing one require changing the other?" — Yes → unify. No → suppress.

### Using `@public`

Suppression comments are a last resort, not a first response. Fix the root cause: delete unused code. `@public` is only acceptable when the export is intentionally kept for downstream/template usage and is not consumed within the current codebase.
