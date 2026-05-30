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

## Chrome DevTools MCP

`chrome-devtools-mcp` はセッションごとにプロセスが残りやすい。ツール呼び出しが "browser is already running" で失敗した場合、`pkill -f chrome-devtools-mcp` で古いプロセスを全て kill してからリトライする。`ps aux | grep chrome-devtools-mcp` で残存プロセスを確認できる。

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

## Aegis maintenance (admin surface)

After editing or adding files under `.claude/rules/` or `docs/adr/`, sync Canonical Knowledge with `aegis_sync_docs` (edits to existing files) / `aegis_import_doc` (new files). Pitfalls:

- **Do not trust a "failure" response from the sync tools.** `aegis_sync_docs` can return an error like `Sync failed: undefined` while still having created the update proposals internally. Retrying then stacks duplicate proposals. After any `aegis_*` sync/import call, **always verify what was created with `aegis_list_proposals`** — do not blindly re-run just because it errored. (Observed: the `undefined` error happens on a full sync; scoping the call with `doc_ids` returns cleanly.)
- **Inspect each proposal with `aegis_get_proposal` before approving.** sync / import also produce update proposals for **other stale file-anchored docs** (e.g. `rule-tools`, edited in an earlier commit and never synced) and **byte-identical duplicate** proposals. Approve the right one with `aegis_approve_proposal` and clear the rest with `aegis_reject_proposal`. Proposals sharing the same `content_hash` are byte-identical, so approving any one of them is enough.
- **Do not judge a doc's registration / staleness state from `aegis_get_stats` alone.** A doc that is not file-anchored, or one already up to date, never shows up as stale — `stale_docs_count: 0` does NOT mean "not registered." Confirm registration via `aegis_analyze_doc`'s `overlap_warnings` (similarity to an existing `doc_id`) or `aegis_list_proposals`.
