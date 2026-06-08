# Tools

- **tsgo**: Type checker. Run `bun run typecheck`.
- **oxlint**: Linter. Run `bun run lint`. Config: `.oxlintrc.json`. Type-aware linting is enabled (`--type-aware` flag) — rules that require type information (e.g., `no-unsafe-type-assertion`, `no-unnecessary-template-expression`) are active.
- **oxfmt**: Formatter. Run `bun run format:fix` to fix, `bun run format` to verify (check-only).
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

## Chrome DevTools MCP

`chrome-devtools-mcp` はセッションごとにプロセスが残りやすい。ツール呼び出しが "browser is already running" で失敗した場合、`pkill -f chrome-devtools-mcp` で古いプロセスを全て kill してからリトライする。`ps aux | grep chrome-devtools-mcp` で残存プロセスを確認できる。

## Dependencies — Exact Version Pinning

Dependency versions in `package.json` must be **fully pinned**. Do not use range specifiers (`^`, `~`) or major-only notation (`"4"`, `"^20"`) — always write exact versions like `"1.2.3"`.

**NG**

```json
{
  "dependencies": {
    "next": "^16.1.1",
    "react": "^19.2.3"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20"
  }
}
```

**OK**

```json
{
  "dependencies": {
    "next": "16.1.1",
    "react": "19.2.3"
  },
  "devDependencies": {
    "typescript": "5.8.3",
    "@types/node": "20.19.9"
  }
}
```

**When adding or updating:**

- Add as exact: `bun add -E <pkg>` / `bun add -E -d <pkg>`.
- When updating an existing dependency, check that no `^` / `~` / major-only notation remains in `package.json` after the update. If a range crept in, fix it manually to exact.
- To see the currently installed versions, use `bun pm ls`.

Rationale: this is a template repository, so derivative projects must not see environment drift. Updates are intentional, and `package.json` must always match the lockfile.
