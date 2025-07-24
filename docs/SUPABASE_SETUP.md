# Supabase Setup Guide

このガイドでは、Supabase認証とストレージ機能のセットアップ手順を説明します。

## 1. Supabaseプロジェクトのセットアップ

1. [Supabase](https://supabase.com)でアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクトのダッシュボードから以下の情報を取得：
   - Project URL
   - Anon Key

## 2. GitHub OAuth設定

### GitHub側の設定
1. GitHubの[Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)にアクセス
2. 「New OAuth App」をクリック
3. 以下の情報を入力：
   - **Application name**: アプリ名（任意）
   - **Homepage URL**: `http://localhost:3000`（開発環境）
   - **Authorization callback URL**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. アプリケーションを登録後、Client IDとClient Secretを取得

### Supabase側の設定
1. Supabaseダッシュボードで「Authentication」→「Providers」にアクセス
2. GitHubプロバイダーを有効化
3. GitHubで取得したClient IDとClient Secretを入力
4. 「Save」をクリック

## 3. Google OAuth設定

### Google側の設定
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

### Supabase側の設定
1. Supabaseダッシュボードで「Authentication」→「Providers」にアクセス
2. Googleプロバイダーを有効化
3. Googleで取得したClient IDとClient Secretを入力
4. 「Save」をクリック

## 4. 環境変数の設定

```bash
# .env.localファイルを作成
cp .env.example .env.local
```

`.env.local`ファイルを編集し、Supabaseの認証情報を設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

## 5. Supabase Storageのセットアップ

プロフィール画像のアップロード機能を使用するために、まずSupabase Storageのバケットを作成します：

### avatarsバケットの作成

1. Supabaseダッシュボードの「Storage」にアクセス
2. 「New bucket」をクリック
3. 以下の設定でバケットを作成：
   - **Name**: `avatars`
   - **Public bucket**: チェックを入れる（画像を公開アクセス可能にする）
   - **File size limit**: 5MB（5242880 bytes）
   - **Allowed MIME types**: `image/*`（画像ファイルのみ許可）

## 6. データベースとストレージポリシーのセットアップ

バケット作成後、データベースとストレージポリシーを一括でセットアップします：

### 初期セットアップSQLの実行

1. Supabaseダッシュボードの「SQL Editor」にアクセス
2. `supabase/migrations/000_initial_setup.sql`の内容を実行

このSQLは以下を自動的にセットアップします：
- **usersテーブル**: ユーザープロフィール情報を保存
- **自動ユーザー作成**: 新規登録時に自動的にプロフィールレコードを作成
- **RLSポリシー**: usersテーブルのセキュリティポリシー
- **ストレージポリシー**: avatarsバケットのアクセス制御ポリシー

### テーブル構造

```sql
public.users
├── id (UUID) - auth.usersへの外部キー
├── created_at (TIMESTAMP) - 作成日時
├── updated_at (TIMESTAMP) - 更新日時（自動更新）
├── name (TEXT) - ユーザー名
└── avatar_url (TEXT) - アバター画像のURL
```

### 自動設定されるポリシー

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

## トラブルシューティング

### ストレージポリシーが適用されない場合

SQLでストレージポリシーが正しく作成されない場合は、手動で設定できます：

1. Storageダッシュボードで「Policies」タブを選択
2. 「New Policy」から「For full customization」を選択
3. 各ポリシーを手動で作成

### 認証エラーが発生する場合

1. 環境変数が正しく設定されているか確認
2. OAuthプロバイダーのコールバックURLが正しいか確認
3. Supabaseプロジェクトの設定でサイトURLが正しく設定されているか確認