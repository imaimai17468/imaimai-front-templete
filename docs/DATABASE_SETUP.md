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
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8787

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

### CLOUDFLARE_ACCOUNT_ID の取得

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Workers & Pages** をクリック
3. 右サイドバーに表示される **Account ID** をコピー

CLIでも取得可能：
```bash
wrangler whoami
```

### CLOUDFLARE_D1_DATABASE_ID の取得

手順1で `wrangler d1 create` を実行した際に出力された `database_id` の値。

後から確認する場合：
```bash
wrangler d1 list
```

### Cloudflare API Token の作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) でAPIトークンを作成
2. 「カスタムトークンを作成」を選択
3. 必要な権限:
   - **Account > D1 > Edit**
   - **Account > Workers R2 Storage > Edit**

### R2_PUBLIC_URL の取得

R2バケットを公開アクセス可能にする必要があります。

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) > **R2 Object Storage** > `imaimai-avatars`
2. **Settings** タブを開く
3. **パブリック開発 URL** を有効化する
4. 発行されるURLが `R2_PUBLIC_URL` の値（例: `https://pub-xxxxxxxx.r2.dev`）

> **本番環境**: カスタムドメインを設定することも可能です。

## 4. OAuth認証を設定

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) > **APIとサービス** > **認証情報**
2. **認証情報を作成** > **OAuthクライアントID** を選択
3. アプリケーションの種類: **ウェブアプリケーション**
4. **承認済みの JavaScript 生成元** に以下を追加:
   - `http://localhost:8787`（開発時）
5. **承認済みのリダイレクト URI** に以下を追加:
   - `http://localhost:8787/api/auth/callback/google`（開発時）
6. 作成後、Client ID / Client Secret を `.env.local` に設定

> **本番環境**: 生成元とリダイレクト URI にデプロイ先のURLも追加してください。
> - 生成元: `https://your-domain.pages.dev`
> - リダイレクト URI: `https://your-domain.pages.dev/api/auth/callback/google`

## 5. データベースを初期化

### リモート D1 に適用（本番・ステージング）

```bash
# マイグレーションファイルを生成
bun run db:generate

# D1に適用
bun run db:push
```

### ローカル D1 に適用（開発用）

`bun run preview` で使用するローカル D1 には、マイグレーション SQL を適用する必要があります。

```bash
# マイグレーションファイルを生成（初回 or スキーマ変更時）
bun run db:generate

# ローカル D1 に適用
bun run db:push:local
```

`db:push:local` はローカル D1 をリセットし、`src/lib/drizzle/migrations/` 内の全マイグレーション SQL を適用します。スキーマ変更時も `db:generate` → `db:push:local` の順で実行すれば OK です（ローカルデータはリセットされます）。

## 6. 動作確認

```bash
bun run preview
```

ローカルでCloudflare Workers環境をエミュレートして実行します。

> **注意**: D1・R2・Better Auth はCloudflare Workersランタイム上でのみ動作します。`bun run dev` では `getCloudflareContext()` が使えないため、認証やDB操作の確認には必ず `bun run preview` を使用してください。

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
