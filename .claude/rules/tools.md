# Tools

- **tsgo**: Type checker. Run `bun run typecheck`.
- **oxlint**: Linter. Run `bun run lint`. Config: `.oxlintrc.json`. Type-aware linting is enabled (`--type-aware` flag) — rules that require type information (e.g., `no-unsafe-type-assertion`, `no-unnecessary-template-expression`) are active.
- **oxfmt**: Formatter. Run `bun run format:fix` to fix, `bun run format` to verify (check-only).
- **knip**: Detects unused dependencies, exports, and files. Run `bun run knip`. Config: `knip.json`.
- **similarity**: Detects duplicate/similar code. Run `similarity-ts ./src` to scan, add `--print` to show code, `--threshold <value>` to adjust sensitivity. Default threshold is `0.87`. Only findings at or above the threshold are reported. When the stop hook fires with similarity findings, evaluate the score: findings above `0.90` almost certainly indicate real duplication worth refactoring; findings between `0.87–0.90` may be structural coincidence — inspect before deciding.
- **wrangler types**: Generates `CloudflareEnv` from `wrangler.toml`. Run `bun run cf-typegen` after changing bindings. Output `worker-configuration.d.ts` is gitignored — regenerate locally; do not hand-edit.

## Aegis Knowledge Base

The canonical knowledge lives in `aegis-share/source/` (git-tracked: documents + edge definitions). `.aegis/aegis.db` is a local artifact (gitignored) built from it.

- **Fresh clone**: the SessionStart hook (`session-start-aegis-hydrate.sh`) rebuilds the DB from the committed bundle (`aegis-share/manifest.json` + `canonical.json`) automatically. Manual equivalent: `npx -y @fuwasegu/aegis share-hydrate`. After hydrating, call `aegis_sync_docs` once to re-anchor file-anchored docs (doctor reports them stale until then).
- **If `aegis_compile_context` returns no documents**, run `share-hydrate` — do NOT bootstrap with `aegis_import_doc`. This rule overrides the generic "When Knowledge Base Is Empty" guidance in the Aegis-managed section of CLAUDE.md / AGENTS.md.
- **After editing `.claude/rules/` or `docs/adr/`**: update the body of the matching `aegis-share/source/documents/*.md` (keep its frontmatter), then run `share-format` → `share-lint` → `share-materialize` → `share-export` (the export keeps the committed bundle in sync). `npx -y @fuwasegu/aegis doctor` detects stale docs and bundle drift.
- Pin the CLI to the same version as `.mcp.json`. Note: unknown subcommands are silently ignored and start the MCP server instead — if a `share-*` command appears to hang or prints "MCP server started", check the version supports it.

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
