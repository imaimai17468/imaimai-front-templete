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
- **Hosting**: Cloudflare Pages (@opennextjs/cloudflare)
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

#### ドキュメント

- **[データベースセットアップガイド](./docs/DATABASE_SETUP.md)** - Cloudflare D1 + Drizzle ORM + Better Auth の設定手順

#### 必要な設定

1. Cloudflare D1データベースとR2バケットの作成
2. OAuth認証の設定（Google）
3. 環境変数の設定
4. データベーススキーマの適用

### 開発サーバーの起動

```bash
bun run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## 利用可能なコマンド

### 開発

```bash
bun run dev          # 開発サーバーを起動
bun run build        # プロダクション用ビルド
bun run start        # プロダクションサーバーを起動
```

### デプロイ

```bash
bun run preview      # Cloudflare Pages ローカルプレビュー
bun run deploy       # Cloudflare Pages デプロイ
```

### コード品質

```bash
bun run typecheck    # TypeScript型チェック (tsgo)
bun run lint         # oxlint チェック
bun run lint:fix     # oxlint 自動修正
bun run format       # oxfmt フォーマットチェック
bun run format:fix   # oxfmt 自動フォーマット
bun run check        # lint + format チェック
bun run check:fix    # lint + format 自動修正
```

### テスト

```bash
bun run test         # Vitestでテスト実行
```

### データベース

```bash
bun run db:generate  # Drizzle migration生成
bun run db:push      # Drizzle migration適用
bun run db:studio    # Drizzle Studioを起動
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

このプロジェクトは厳密なコーディング規約に従っています：

- **コンポーネント命名**: ディレクトリ名（kebab-case）とTSXファイル名（PascalCase）の対応
- **インポート**: `@/` エイリアスを使用した絶対パス
- **コード品質**: oxlint/oxfmtによる自動linting/formatting
- **Git Hooks**: コミット前の自動品質チェック

詳細は `CLAUDE.md` を参照してください。

## Git Hooks

Lefthookにより以下のフックが自動実行されます：

- **Pre-commit**: `bun run check:fix` による自動修正
- **Pre-push**: `bun run check` と `bun run typecheck` による品質チェック

## shadcn/ui

shadcn/uiコンポーネントは `src/components/ui/` に配置されています。新しいコンポーネントを追加する場合：

```bash
bunx shadcn@latest add [component-name]
```

## 認証機能

このテンプレートには、Better Authを使用した認証機能が実装されています：

- Google OAuth認証
- ログイン/ログアウト機能
- 認証状態に応じたUIの出し分け
- ミドルウェアによるルート保護

### 認証フロー

1. ユーザーが「Sign In」ボタンをクリック
2. `/login`ページでGoogleログインボタンをクリック
3. 選択したプロバイダーの認証画面にリダイレクト
4. Better Authがコールバックを処理しセッションを作成
5. ホームページにリダイレクト

## プロフィール機能

ユーザーは自分のプロフィール情報を管理できます：

### 機能一覧

- **プロフィール表示**: `/profile`ページでユーザー情報を表示
- **名前の編集**: 表示名を自由に変更可能
- **アバター画像のアップロード**:
  - 最大5MBまでの画像ファイルをアップロード
  - アップロード中のプログレス表示
  - 即時プレビュー機能
  - Cloudflare R2に安全に保存

### プロフィール編集フロー

1. ヘッダーのユーザーメニューから「Profile」を選択
2. `/profile`ページでプロフィール情報を確認
3. アバター画像をクリックして新しい画像を選択
4. 名前フィールドを編集
5. 「Update Profile」ボタンで保存

### 技術的な実装

- **データ管理**: D1の`users`テーブルでユーザー情報を管理
- **画像保存**: Cloudflare R2に保存
- **リアルタイムバリデーション**: Zodスキーマによる入力検証
- **アクセシビリティ**: shadcn/uiのFormコンポーネントでWCAG準拠

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
