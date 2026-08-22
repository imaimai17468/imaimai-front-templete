# My App

TanStack Start + TypeScript + Tailwind CSS + shadcn/ui を使用したモダンな Web アプリケーションテンプレートです。

## 技術スタック

- **Framework**: TanStack Start (TanStack Router + Vite)
- **Language**: TypeScript 7 (native compiler)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Authentication**: Better Auth (Google OAuth)
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Storage**: Cloudflare R2
- **Hosting**: Cloudflare Workers (@cloudflare/vite-plugin)
- **Code Quality**: oxlint (linting) + oxfmt (formatting)
- **Testing**: Vitest + Testing Library
- **Package Manager**: Bun
- **Git Hooks**: Lefthook

## クイックスタート

```bash
git clone <your-repo-url>
cd <your-repo-name>
mise install   # Node / Bun を mise.toml の版で用意
bun install
bun run generate-routes
bun run cf-typegen
cp .env.local.example .env.local
bun run dev
```

[mise](https://mise.jdx.dev/) を使わない場合は、`package.json` の `engines.node` を満たす Node と、`mise.toml` が指定する版の Bun を手動で用意してください。Cursor Cloud Agent 環境では `.cursor/environment.json` が同じセットアップ（`scripts/cloud-agent-install.sh`）を自動実行します。shims の PATH 追記は rc ファイルを読むシェルにしか効かないため、rc を読まない非対話シェルからは `mise exec -- <コマンド>` で実行してください。

http://localhost:5173 でアクセス。`@cloudflare/vite-plugin` により、`bun run dev` でも Cloudflare D1 / R2 バインディングが有効です。

データベース・認証・ストレージのセットアップ手順は [docs/DATABASE_SETUP.md](./docs/DATABASE_SETUP.md)、デプロイ・ロールバック・シークレット運用は [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)、このテンプレートを新規プロジェクトに使う手順は [docs/FORKING.md](./docs/FORKING.md)、サーバ境界を oRPC / BFF 構成へ動かす場合の前提は [docs/SERVER_BOUNDARY.md](./docs/SERVER_BOUNDARY.md) を参照。

## Scripts

| Command                   | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `bun run dev`             | Start dev server (with CF bindings via workerd) |
| `bun run build`           | Production build                                |
| `bun run bundle:analyze`  | Build and report Worker upload composition      |
| `bun run preview`         | Build & preview in local workerd                |
| `bun run deploy`          | Build & deploy to Cloudflare Workers            |
| `bun run typecheck`       | Type check with tsc (TypeScript 7 native)       |
| `bun run lint`            | Run oxlint (type-aware)                         |
| `bun run lint:fix`        | Run oxlint with auto-fix                        |
| `bun run format`          | Check formatting with oxfmt                     |
| `bun run format:fix`      | Format with oxfmt                               |
| `bun run check`           | lint + format check (pre-push runs this and `typecheck`) |
| `bun run check:fix`       | lint + format with auto-fix                     |
| `bun run generate-routes` | Regenerate TanStack Router route tree           |
| `bun run knip`            | Detect unused deps/exports/files                |
| `bun run test`            | Run tests with Vitest                           |
| `bun run cf-typegen`      | Generate `CloudflareEnv` from `wrangler.toml`   |
| `bun run db:generate`     | Generate Drizzle migrations from the schema     |
| `bun run db:push`         | Push the schema to the remote D1 database       |
| `bun run db:push:local`   | Set up / migrate the local D1 database          |
| `bun run db:seed:local`   | Seed the local D1 database with dev data        |
| `bun run db:studio`       | Open Drizzle Studio                             |
| `bun run db:pull`         | Introspect the remote D1 schema                 |

## Tools

- **[mise](https://mise.jdx.dev/)** — Node / Bun のバージョン固定 (`mise.toml`)
- **[shadcn/ui](https://ui.shadcn.com/)** — UI components (`components.json`)
- **[TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)** — Type checker (Go-native `tsc`)
- **[oxlint](https://oxc.rs/docs/guide/usage/linter)** — Linter (`.oxlintrc.json`)
- **自作 oxlint プラグイン** (`tools/oxlint-plugins/`) — `.oxlintrc.json` の `jsPlugins` から読み込まれる。層契約・コンポーネント命名・1ファイル1コンポーネント・テストの形（1テスト1 expect など）を機械的に強制するので、規約は文書だけでなくここにもある
- **[react-doctor](https://github.com/millionco/react-doctor)** — React 向け追加ルール (`.oxlintrc.react-doctor.json`)
- **[oxfmt](https://oxc.rs/docs/guide/usage/formatter)** — Formatter (`.oxfmtrc.json`)
- **[lefthook](https://github.com/evilmartians/lefthook)** — Git hooks (`lefthook.yml`、`bun install` 時に `prepare` スクリプトで自動セットアップ)
- **[knip](https://knip.dev/)** — Unused deps/exports/files detection (`knip.json`)
- **[similarity-ts](https://github.com/mizchi/similarity)** — Code similarity detector
- **python3** — ゲート用スクリプトの実行環境（下記）

### python3 が要るもの

`scripts/` の Python スクリプトはビルドには関与しませんが、ゲートの一部です。多くの macOS / Linux 環境には既に入っています。入っていなければ SessionStart の env-check が報告するので、そのとき入れれば足ります。

| スクリプト | 役割 |
| --- | --- |
| `check-md-links.py` | markdown の相対リンク切れを検出。Stop gate と CI が自動実行 |
| `test-md-links.py` | 上記リンクチェッカー自身の回帰テスト |
| `test-bash-guard.py` | Bash ガード（`.env` 保護・`find` の到達範囲）の検証 |

`test-*.py` は該当フックを触ったときに手で回します（`python3 scripts/test-bash-guard.py` など）。未インストールの環境では SessionStart の env-check が欠落を報告し、Stop gate はリンクチェックを「スキップした」と明示します（黙って合格扱いにはなりません）。

### similarity-ts のインストール

`similarity-ts` は Rust 製のため `cargo` が必要です。別途インストールしてプロジェクトルートから実行：

```bash
cargo install similarity-ts

similarity-ts ./src                  # デフォルト
similarity-ts ./src --print          # マッチしたコードを表示
similarity-ts ./src --threshold 0.7  # デフォルトは 0.85
```

Stop quality gate hook が自動実行するので、手動実行は調査時のみ。未インストールの環境では SessionStart の env-check が欠落を報告し、Stop gate は「スキップした」と明示します（黙って合格扱いにはなりません）。

## プロジェクト構成

```
src/
├── routes/                 # TanStack Router file-based routes
│   ├── __root.tsx          # Root layout (ThemeProvider, Header, Toaster)
│   ├── index.tsx           # Home page
│   ├── login.tsx           # Login page
│   ├── profile.tsx         # Profile page (auth guard via beforeLoad)
│   ├── auth.auth-code-error.tsx  # OAuth failure landing page
│   └── api/                # API routes (auth catch-all, avatars)
├── server/
│   ├── cloudflare.ts       # CloudflareEnv helper (cloudflare:workers)
│   └── fn/                 # Server functions (createServerFn)
├── gateways/               # D1 / R2 persistence
├── entities/               # Domain types and schemas
├── components/             # Shared UI components
│   ├── ui/                 # shadcn/ui primitives
│   ├── shared/             # Cross-page shared components
│   └── features/           # Feature-specific components
├── lib/
│   ├── auth/               # Better Auth 設定
│   ├── drizzle/            # Drizzle ORM スキーマ
│   ├── storage/            # R2 ストレージ
│   └── utils.ts
├── test/                   # Test helpers (router harness, cloudflare:workers stub)
├── router.tsx              # TanStack Router definition
├── ssr.tsx                 # Server entry (Cloudflare Worker handler)
├── test-setup.ts           # Vitest setup
└── styles.css              # Tailwind v4 tokens
```

配置と import 方向の規約は [AGENTS.md](./AGENTS.md) の `Rules` を参照してください。

## AI エージェントで開発する

規約は **[AGENTS.md](./AGENTS.md)** 1枚に集約され、毎セッション自動でロードされます。チケット粒度の作業手順（明確化 → 設計判断 → 計画 → 相互作用の確認 → 実装 → 自己チェック → レビュー → コミット）は `ticket-work` skill が持ち、AGENTS.md はそれを指します。ファイル種別ごとの規約は `.claude/rules/` に置かれ、対象を編集するときだけロードされます。この手順自体は MCP サーバやプラグインの有無に依存しません — 一部のオプション skill（`lighthouse-audit` / `performance-audit` / `launch-checklist`）は `chrome-devtools-mcp` を使いますが、コアの流れには必須ではありません。

コミット前のレビューは `code-reviewer` エージェントが担います。親が1体 dispatch し、そのエージェントが「候補の網羅探索 → 重複統合 → 実コードでの反証 → 生存分の返却」を1コンテキストで通します。返ってきた所見を適用して、そのままコミットします（find → verify → fix → commit の一発勝負）。1回のレビューから複数コミットに分割するのも普通にできます。レビューを機械的に強制する仕組みは置いていません。

状態遷移が非自明な機能（ウィザード、認証・セッション、非同期ガード、権限分岐）は、実装前に状態機械として並べ、ガードが全部成立したまま破れる経路と、合法な操作の組み合わせで到達してしまう結果を探します。レビューの品質は golden eval（`scripts/evals/`）で回帰計測されます。コミット・PR はエージェントが AGENTS.md の規律に従って提案し、ユーザー確認後に実行します。

## shadcn/ui

```bash
bunx shadcn@latest add [component-name]
```

## 参考リンク

- [TanStack Start](https://tanstack.com/start/)
- [TanStack Router](https://tanstack.com/router/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Better Auth](https://www.better-auth.com/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [oxc (oxlint/oxfmt)](https://oxc.rs/)
- [Vitest](https://vitest.dev/)
