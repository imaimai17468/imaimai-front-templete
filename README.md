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
bun run preview
```

http://localhost:8787 でアプリケーションにアクセスできます。

> D1・R2・Better Auth はCloudflare Workersランタイム上で動作するため、`bun run preview` を使用してください。

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

このプロジェクトは厳密なコーディング規約に従っています：

- **コンポーネント命名**: ディレクトリ名（kebab-case）とTSXファイル名（PascalCase）の対応
- **インポート**: `@/` エイリアスを使用した絶対パス
- **コード品質**: oxlint/oxfmtによる自動linting/formatting
- **Git Hooks**: コミット前の自動品質チェック

詳細は `CLAUDE.md` を参照してください。

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
