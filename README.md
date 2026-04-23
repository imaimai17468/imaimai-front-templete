# My App

Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui を使用したモダンなWebアプリケーションテンプレートです。

## 技術スタック

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (tsgo)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Authentication**: Better Auth (Google OAuth)
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Storage**: Cloudflare R2
- **Hosting**: Cloudflare Workers (@opennextjs/cloudflare)
- **Code Quality**: oxlint (linting) + oxfmt (formatting)
- **Testing**: Vitest + Testing Library
- **Package Manager**: Bun
- **Git Hooks**: Lefthook

## 開発環境のセットアップ

### 前提条件

- Node.js 18.0.0 以上
- Bun (推奨) または npm/yarn/pnpm
- Cloudflareアカウント
- Googleアカウント（OAuth認証用）

### クイックスタート

```bash
# リポジトリをクローンまたはテンプレートから作成
git clone <your-repo-url>
cd <your-repo-name>

# 依存関係をインストール
bun install

# 環境変数の設定
cp .env.local.example .env.local
```

### Cloudflare + Better Auth のセットアップ

このテンプレートはCloudflare D1/R2 + Better Authを使用した認証とデータ管理を実装しています。

- **[データベースセットアップガイド](./docs/DATABASE_SETUP.md)** - Cloudflare D1 + Drizzle ORM + Better Auth の設定手順

### 開発サーバーの起動

```bash
bun run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

> `next.config.mjs` で `initOpenNextCloudflareForDev` を使用しているため、`bun run dev` でもCloudflare D1/R2バインディングが有効になります。

## Scripts

| Command               | Description                      |
| --------------------- | -------------------------------- |
| `bun run dev`         | Start dev server                 |
| `bun run build`       | Production build                 |
| `bun run typecheck`   | Type check with tsgo             |
| `bun run lint`        | Run oxlint                       |
| `bun run format`      | Check formatting with oxfmt      |
| `bun run format:fix`  | Format with oxfmt                |
| `bun run knip`        | Detect unused deps/exports/files |
| `bun run test`        | Run tests with Vitest            |

## Tools

- **[shadcn/ui](https://ui.shadcn.com/)** - UI components (`components.json`)
- **[tsgo](https://github.com/microsoft/typescript-go)** - Type checker (`@typescript/native-preview`)
- **[oxlint](https://oxc.rs/docs/guide/usage/linter)** - Linter (`.oxlintrc.json`)
- **[oxfmt](https://oxc.rs/docs/guide/usage/formatter)** - Formatter (`.oxfmtrc.json`)
- **[lefthook](https://github.com/evilmartians/lefthook)** - Git hooks (`lefthook.yml`)
  - pre-commit: lint + format check
- **[knip](https://knip.dev/)** - Unused deps/exports/files detection (`knip.json`)
- **[similarity](https://github.com/mizchi/similarity)** - Code similarity detector (requires separate install)

## Claude Code

### Hooks

`.claude/settings.json` で以下の hook を設定しています。

#### PreToolUse (`Edit` / `Write` / `MultiEdit`)

編集前に coding-guide 違反を静的に検査してブロック:

- `.claude/hooks/pre-tool-use-guard.sh` - `for`/`while` ループ、Tailwind arbitrary value (`[...]`)、色の透明度修飾子 (`-XXX/YY`) などを検出

#### PostToolUse (`Edit` / `Write` / `MultiEdit`)

`.ts` / `.tsx` / `.js` / `.jsx` / `.mjs` / `.cjs` を編集したら即座に検証:

- `bun run lint` - oxlint
- `bun run typecheck` - tsgo
- 失敗時は次のツール呼び出し前に修正するようブロック

#### Stop (作業終了時)

1. **Quality gate** (`stop-quality-gate.sh`) - すべて失敗でブロック
   - `bun run typecheck` / `bun run lint` / `bun run format` / `bun run knip` / `similarity-ts ./src`
2. **Agent review** (`stop-agent-review.sh`) - headless Claude (Opus) で `.claude/rules/*.md` に沿ったレビュー
3. **Component verify** (`stop-component-verify.sh`) - chrome-devtools MCP で新規コンポーネントの動作確認

### Skills

| Command         | Description                                    |
| --------------- | ---------------------------------------------- |
| `/commit`       | 機能ごとにコミットを分割して作成               |
| `/pr`           | 変更内容のみの PR を作成（UI 変更時は demo GIF を自動添付） |

コーディング規約は `.claude/rules/*.md` に分割管理しており、`AGENTS.md` から `@include` で常時ロードされます。

### similarity のインストール

Rust の cargo が必要です。各自でインストールしてください。

```bash
cargo install similarity-ts
```

```bash
# 基本的な使い方
similarity-ts ./src

# コード付きで表示
similarity-ts ./src --print

# 閾値を下げて検出 (default: 0.85)
similarity-ts ./src --threshold 0.7
```

## プロジェクト構成

```
src/
├── app/                    # Next.js App Router
│   ├── api/auth/           # Better Auth APIルート
│   ├── globals.css         # グローバルスタイル
│   ├── layout.tsx          # ルートレイアウト
│   └── page.tsx            # ホームページ
├── components/
│   ├── ui/                 # shadcn/ui コンポーネント
│   ├── shared/             # 共有コンポーネント
│   └── features/           # 機能別コンポーネント
├── entities/               # データ型定義（Zodスキーマ）
├── gateways/               # データ取得関数
├── repositories/           # React Queryカスタムフック
└── lib/
    ├── auth/               # Better Auth設定
    ├── drizzle/            # Drizzle ORM設定・スキーマ
    ├── storage/            # Cloudflare R2ストレージ
    └── utils.ts            # ユーティリティ関数
```

## コーディング規約

コーディングスタイル・アーキテクチャ・依存管理・ツールのルールは [`AGENTS.md`](./AGENTS.md) を参照してください。

## shadcn/ui

shadcn/uiコンポーネントは `src/components/ui/` に配置されています。新しいコンポーネントを追加する場合：

```bash
bunx shadcn@latest add [component-name]
```

## 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Better Auth](https://www.better-auth.com/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [@opennextjs/cloudflare](https://opennext.js.org/cloudflare)
- [oxc (oxlint/oxfmt)](https://oxc.rs/)
- [Vitest](https://vitest.dev/)
