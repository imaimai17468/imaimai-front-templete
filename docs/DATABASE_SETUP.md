# データベースセットアップ

## 1. Cloudflareリソースを作成

### D1 データベース

```bash
wrangler d1 create imaimai-db
```

出力される `database_id` を控えておく。

### R2 バケット

```bash
wrangler r2 bucket create imaimai-avatars
```

## 2. wrangler.toml を設定

`wrangler.toml` の `database_id` を実際の値に更新：

```toml
[[d1_databases]]
binding = "DB"
database_name = "imaimai-db"
database_id = "<ここに実際のdatabase_idを入力>"
```

## 3. 環境変数を設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集：

```env
# Better Auth
BETTER_AUTH_SECRET=<openssl rand -base64 32 で生成>
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# OAuth Providers
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Cloudflare D1 (drizzle-kit用)
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
CLOUDFLARE_D1_DATABASE_ID=<your-d1-database-id>
CLOUDFLARE_API_TOKEN=<your-api-token>

# Cloudflare R2
R2_PUBLIC_URL=<your-r2-public-url>
```

### BETTER_AUTH_SECRET の生成

```bash
openssl rand -base64 32
```

### Cloudflare API Token の作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) でAPIトークンを作成
2. 必要な権限: `D1 Edit`, `Workers R2 Storage Edit`

## 4. OAuth認証を設定

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) でOAuthクライアントを作成
2. 承認済みリダイレクトURI: `http://localhost:3000/api/auth/callback/google`
3. Client ID / Client Secret を `.env.local` に設定

> **本番環境**: コールバックURLのドメインを本番URLに変更してください。

## 5. データベースを初期化

```bash
# マイグレーションファイルを生成
bun run db:generate

# D1に適用
bun run db:push
```

## 6. 動作確認

### ローカル開発

```bash
bun run dev
```

http://localhost:3000 でアプリケーションが起動します。

### Cloudflare Pages プレビュー

```bash
bun run preview
```

ローカルでCloudflare Workers環境をエミュレートして実行します。

## 補足：Drizzleコマンド

スキーマ変更時に使用：

```bash
# スキーマからマイグレーション生成
bun run db:generate

# スキーマを直接DBに反映（開発時）
bun run db:push

# データベースGUIを起動
bun run db:studio

# DBスキーマからDrizzleスキーマを生成
bun run db:pull
```

## 補足：デプロイ

Cloudflare Pagesへのデプロイ：

```bash
bun run deploy
```

本番環境の環境変数は Cloudflare Dashboard > Pages > Settings > Environment variables で設定してください。
