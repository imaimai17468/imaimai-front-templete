# My App

Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui を使用したモダンなWebアプリケーションテンプレートです。

## 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Authentication**: Supabase Auth
- **Code Quality**: Biome (linting & formatting)
- **Testing**: Vitest + Testing Library
- **Storybook**: Component development & documentation
- **Package Manager**: Bun
- **Git Hooks**: Lefthook

## 開発環境のセットアップ

### 前提条件

- Node.js 18.0.0 以上
- Bun (推奨) または npm/yarn/pnpm
- Supabaseアカウント
- GitHubアカウント（OAuth認証用）
- Googleアカウント（OAuth認証用）

### 1. リポジトリのセットアップ

```bash
# リポジトリをクローンまたはテンプレートから作成
git clone <your-repo-url>
cd <your-repo-name>

# 依存関係をインストール
bun install
```

### 2. Supabaseプロジェクトのセットアップ

1. [Supabase](https://supabase.com)でアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクトのダッシュボードから以下の情報を取得：
   - Project URL
   - Anon Key

### 3. GitHub OAuth設定

#### GitHub側の設定
1. GitHubの[Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)にアクセス
2. 「New OAuth App」をクリック
3. 以下の情報を入力：
   - **Application name**: アプリ名（任意）
   - **Homepage URL**: `http://localhost:3000`（開発環境）
   - **Authorization callback URL**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. アプリケーションを登録後、Client IDとClient Secretを取得

#### Supabase側の設定
1. Supabaseダッシュボードで「Authentication」→「Providers」にアクセス
2. GitHubプロバイダーを有効化
3. GitHubで取得したClient IDとClient Secretを入力
4. 「Save」をクリック

### 4. Google OAuth設定

#### Google側の設定
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. 「APIとサービス」→「認証情報」にアクセス
4. 「認証情報を作成」→「OAuth クライアント ID」をクリック
5. アプリケーションの種類で「ウェブ アプリケーション」を選択
6. 以下の情報を入力：
   - **名前**: アプリ名（任意）
   - **承認済みのJavaScript生成元**: `http://localhost:3000`（開発環境）
   - **承認済みのリダイレクトURI**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
7. 作成後、Client IDとClient Secretを取得

#### Supabase側の設定
1. Supabaseダッシュボードで「Authentication」→「Providers」にアクセス
2. Googleプロバイダーを有効化
3. Googleで取得したClient IDとClient Secretを入力
4. 「Save」をクリック

### 5. 環境変数の設定

```bash
# .env.localファイルを作成
cp .env.example .env.local
```

`.env.local`ファイルを編集し、Supabaseの認証情報を設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 6. Supabase Storageのセットアップ

プロフィール画像のアップロード機能を使用するために、まずSupabase Storageのバケットを作成します：

#### avatarsバケットの作成

1. Supabaseダッシュボードの「Storage」にアクセス
2. 「New bucket」をクリック
3. 以下の設定でバケットを作成：
   - **Name**: `avatars`
   - **Public bucket**: チェックを入れる（画像を公開アクセス可能にする）
   - **File size limit**: 5MB（5242880 bytes）
   - **Allowed MIME types**: `image/*`（画像ファイルのみ許可）

### 7. データベースとストレージポリシーのセットアップ

バケット作成後、データベースとストレージポリシーを一括でセットアップします：

#### 初期セットアップSQLの実行

1. Supabaseダッシュボードの「SQL Editor」にアクセス
2. `supabase/migrations/000_initial_setup.sql`の内容を実行

このSQLは以下を自動的にセットアップします：
- **usersテーブル**: ユーザープロフィール情報を保存
- **自動ユーザー作成**: 新規登録時に自動的にプロフィールレコードを作成
- **RLSポリシー**: usersテーブルのセキュリティポリシー
- **ストレージポリシー**: avatarsバケットのアクセス制御ポリシー

#### テーブル構造

```sql
public.users
├── id (UUID) - auth.usersへの外部キー
├── created_at (TIMESTAMP) - 作成日時
├── updated_at (TIMESTAMP) - 更新日時（自動更新）
├── name (TEXT) - ユーザー名
└── avatar_url (TEXT) - アバター画像のURL
```

#### 自動設定されるポリシー

**usersテーブル:**
- ユーザーは自分のデータのみ参照・更新可能

**avatarsバケット:**
- 誰でもアバター画像を閲覧可能（Public Read）
- 認証済みユーザーは自分のフォルダ内のみ操作可能

**ファイル構造：**
```
avatars/
└── {user_id}/
    └── avatar.{extension}
```

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
bun run typecheck    # TypeScript型チェック
```

### コード品質

```bash
bun run check        # Biome linter/formatter チェック
bun run check:fix    # Biome 自動修正（unsafe修正含む）
bun run format       # Biome フォーマットチェック
bun run format:fix   # Biome 自動フォーマット
```

### テスト

```bash
bun run test         # Vitestでテスト実行
```

### Storybook

```bash
bun run storybook        # Storybook開発サーバーを起動 (http://localhost:6006)
bun run build-storybook  # Storybookをビルド
```

## プロジェクト構成

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # グローバルスタイル
│   ├── layout.tsx         # ルートレイアウト
│   └── page.tsx           # ホームページ
├── components/
│   ├── ui/                # shadcn/ui コンポーネント
│   ├── shared/            # 共有コンポーネント
│   └── features/          # 機能別コンポーネント
└── lib/
    └── utils.ts           # ユーティリティ関数
```

## コーディング規約

このプロジェクトは厳密なコーディング規約に従っています：

- **コンポーネント命名**: ディレクトリ名（kebab-case）とTSXファイル名（PascalCase）の対応
- **インポート**: `@/` エイリアスを使用した絶対パス
- **コード品質**: Biomeによる自動linting/formatting
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

このテンプレートには、Supabase Authを使用した認証機能が実装されています：

- GitHub OAuth認証
- Google OAuth認証
- ログイン/ログアウト機能
- 認証状態に応じたUIの出し分け
- プロフィールアバターの表示

### 認証フロー

1. ユーザーが「Sign In」ボタンをクリック
2. `/login`ページでGitHub/Googleログインボタンをクリック
3. 選択したプロバイダーの認証画面にリダイレクト
4. 認証成功後、`/auth/callback`でセッションを作成
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
  - Supabase Storageに安全に保存

### プロフィール編集フロー

1. ヘッダーのユーザーメニューから「Profile」を選択
2. `/profile`ページでプロフィール情報を確認
3. アバター画像をクリックして新しい画像を選択
4. 名前フィールドを編集
5. 「Update Profile」ボタンで保存

### 技術的な実装

- **データ管理**: `public.users`テーブルでユーザー情報を管理
- **画像保存**: Supabase Storageの`avatars`バケットに保存
- **リアルタイムバリデーション**: Zodスキーマによる入力検証
- **アクセシビリティ**: shadcn/uiのFormコンポーネントでWCAG準拠

## 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Biome](https://biomejs.dev/)
- [Vitest](https://vitest.dev/)
- [Storybook](https://storybook.js.org/)
