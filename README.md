# My App

TanStack Start で作った Web アプリのテンプレートです。Cloudflare Workers で動きます。

## はじめる

```bash
mise install    # Node / Bun などを mise.toml の版で入れる
bun run setup   # 依存、git hooks、生成ファイル、.env.local を用意する
bun run dev     # http://my-app.localhost:1355 で開く
```

`.env.local` には `.env.local.example` の仮の値が入ります。実際のサービスにつなぐ前に書き換えてください。`bun run dev` は Worker と D1・R2 をローカルで動かすので、Cloudflare のアカウントは要りません。

## よく使うコマンド

| コマンド | すること |
| --- | --- |
| `bun run dev` | 開発サーバーを起動する |
| `bun run check` | format・lint・型を検査する（`bun run check:fix` で直す） |
| `bun run test` | テストを実行する |
| `bun run build` | デプロイと同じビルドを、デプロイせずに作る |
| `bunx shadcn@latest add <name>` | shadcn/ui の部品を足す |

## コードの置き場所

```
src/
├── routes/      # URL ごとのページ（TanStack Router のファイルベースルーティング）
├── shared/      # 2つ以上のルートが使うもの
│   ├── components/  # 自分で書いたコンポーネント
│   ├── ui/          # shadcn/ui の部品
│   ├── gateway/     # 認可と D1・R2 へのアクセス
│   └── entities/    # ドメインの型とスキーマ
├── lib/         # 認証、DB、ストレージの設定
└── ssr.tsx      # Worker の入口
```

どこに何を置くかの決まりは [AGENTS.md](./AGENTS.md) の Rules にあります。

## 次に読むもの

| 知りたいこと | 読むもの |
| --- | --- |
| DB・認証・ストレージの設定 | [docs/DATABASE_SETUP.md](./docs/DATABASE_SETUP.md) |
| デプロイ、ロールバック、シークレット | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| 自分のプロジェクトとして使い始める | [docs/FORKING.md](./docs/FORKING.md) |
| AI エージェントで開発するときの決まり | [AGENTS.md](./AGENTS.md) と `.claude/` |

## 困ったとき

- `bun run dev` を起動していない間にルートのファイルを足したり消したりしたときは、`bun run check` や `bun run test` の前に `bun run generate-routes` を実行してください。
- portless を通さずに起動するときは `PORTLESS=0 bun run dev` を使います。`http://localhost:5173` で開きます。
- HTTPS で開くときは `bun run dev:https` を使います（443 番を使うので管理者権限が要ります）。HTTP と HTTPS を切り替える前に `bunx portless proxy stop` を実行してください。
- worktree では URL にブランチ名の末尾が付きます（ブランチ `fix-ui` なら `http://fix-ui.my-app.localhost:1355`）。
- mise を使わないときは、`package.json` の `engines.node` を満たす Node と、`mise.toml` の版の Bun を入れてください。

## 技術スタック

- フレームワーク: TanStack Start（データ取得は TanStack Query）
- 言語: TypeScript 7
- スタイル: Tailwind CSS v4、shadcn/ui
- 認証: Better Auth（Google OAuth。dev ビルドに限り、固定ユーザーでワンクリックログインできる）
- データベース: Cloudflare D1、Drizzle ORM
- ストレージ: Cloudflare R2
- ホスティング: Cloudflare Workers（[Alchemy](https://alchemy.run) で宣言してデプロイ）
- 検査とテスト: Vite+（oxlint・oxfmt）、Vitest
- パッケージマネージャー: Bun
