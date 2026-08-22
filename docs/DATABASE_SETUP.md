# データベースセットアップ

> テンプレートは初期状態で `wrangler.toml` にローカル開発用のダミー値 (`local-db` / `local-avatars` / ゼロ UUID) が入っています。`bun run dev` はこのまま起動でき、`@cloudflare/vite-plugin` がローカル D1/R2 バインディングを提供します。**本番 Cloudflare にデプロイする場合**のみ、以下の手順で実リソースに差し替えてください。

## 1. Cloudflareリソースを作成

### D1 データベース

```bash
wrangler d1 create <任意のデータベース名>
# 例: wrangler d1 create my-project-db
```

出力される `database_id` を控えておく。

### R2 バケット

```bash
wrangler r2 bucket create <任意のバケット名>
# 例: wrangler r2 bucket create my-project-avatars
```

## 2. wrangler.toml を実リソースに差し替え

`wrangler.toml` のダミー値 (`local-db` / `local-avatars` / ゼロ UUID) を実際の値に更新：

```toml
[[d1_databases]]
binding = "DB"
database_name = "<手順1で指定したデータベース名>"
database_id = "<ここに実際のdatabase_idを入力>"

[[r2_buckets]]
binding = "AVATARS_BUCKET"
bucket_name = "<手順1で指定したバケット名>"
```

## 3. 環境変数を設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集：

```env
# Better Auth
# (BETTER_AUTH_URL は wrangler.toml の [vars] で設定済み — 開発時は :5173)
BETTER_AUTH_SECRET=<openssl rand -base64 32 で生成>

# OAuth Providers
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Cloudflare D1 (drizzle-kit用)
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
CLOUDFLARE_D1_DATABASE_ID=<your-d1-database-id>
CLOUDFLARE_API_TOKEN=<your-api-token>

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
3. 必要な権限は **Account > D1 > Edit** のみ。

このトークンを使うのは drizzle-kit の `d1-http` ドライバ (`db:push` /
`db:generate` / `db:pull` / `db:studio`) だけで、D1 以外の権限は不要。R2 の
バケット作成には Wrangler の認証を使い、このトークンは使わない。権限を
最小に保つこと自体がこのトークンをディスクに置く唯一の
緩和策になっている。秘密をディスクに置かない原則の唯一の例外として許容しているもので、
常設ではない — リモートスキーマ作業が終わったら削除するかローテーションし、タスクの間に
置いたままにしない。

R2 バケットは非公開のまま使用します。アバターは認証と所有権確認を行う
`/api/avatars` 経由で配信するため、公開エンドポイントやカスタムドメインを
バケットへ設定しないでください。

## 4. OAuth認証を設定

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) > **APIとサービス** > **認証情報**
2. **認証情報を作成** > **OAuthクライアントID** を選択
3. アプリケーションの種類: **ウェブアプリケーション**
4. **承認済みの JavaScript 生成元** に以下を追加:
   - `http://localhost:5173`（開発時）
5. **承認済みのリダイレクト URI** に以下を追加:
   - `http://localhost:5173/api/auth/callback/google`（開発時）
6. 作成後、Client ID / Client Secret を `.env.local` に設定

> **本番環境**: 生成元とリダイレクト URI にデプロイ先の Workers オリジンも追加してください。カスタムドメインを使わない場合、既定のオリジンは `<Worker名>.<アカウントサブドメイン>.workers.dev` です。
> - 生成元: `https://<Worker名>.<アカウントサブドメイン>.workers.dev`
> - リダイレクト URI: `https://<Worker名>.<アカウントサブドメイン>.workers.dev/api/auth/callback/google`

## 5. データベースを初期化

### リモート D1 に適用（本番・ステージング）

```bash
# マイグレーションファイルを生成
bun run db:generate

# D1に適用
bun run db:push
```

### ローカル D1 に適用（開発用）

```bash
# マイグレーションファイルを生成（初回 or スキーマ変更時）
bun run db:generate

# ローカル D1 に適用
bun run db:push:local
```

`db:push:local` は `wrangler d1 migrations apply` を `--local` で呼び、`d1_migrations` テーブルに記録されていないマイグレーションだけを適用します。既存のローカルデータは残ります。適用先のディレクトリは `wrangler.toml` の `migrations_dir` が drizzle-kit の出力先を指しています。スキーマ変更時も `db:generate` → `db:push:local` の順で実行してください。

## 6. 動作確認

### 開発サーバー（日常的な開発）

```bash
bun run dev
```

`vite.config.ts` の `@cloudflare/vite-plugin` により、`bun run dev` でもローカルの D1/R2 バインディングが使えます。HMR が有効なので日常的な開発にはこちらを使用してください。

### プレビュー（デプロイ前確認）

```bash
bun run preview
```

Cloudflare Workers ランタイムをエミュレートして実行します。デプロイ前の最終確認に使用してください。

| コマンド | ポート | DB/ストレージ | HMR | 用途 |
|---------|--------|-------------|-----|------|
| `bun run dev` | 5173 | ローカルD1/R2 | ○ | 日常的な開発 |
| `bun run preview` | 4173 | ローカルD1/R2 | × | デプロイ前確認 |

### ローカルデータのリセット

```bash
rm -rf .wrangler
bun run db:push:local
```

## 補足：Drizzleコマンド

スキーマ変更時に使用：

```bash
# スキーマからマイグレーション生成
bun run db:generate

# スキーマをリモート D1 に反映（ローカルは db:push:local）
bun run db:push

# データベースGUIを起動
bun run db:studio

# DBスキーマからDrizzleスキーマを生成
bun run db:pull
```

## 補足：デプロイ

Cloudflare Workersへのデプロイ：

```bash
bun run deploy
```

このプロジェクトのデプロイ先は Cloudflare **Workers** です（Pages ではありません）。本番環境の値は種類で置き場所が変わります。

- **秘密でない値**（`BETTER_AUTH_URL` など）: `wrangler.toml` の `[vars]` に置き、コミットする。
- **秘密の値**（`BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_SECRET` など）: `wrangler secret put <NAME>` で登録する。ファイルには絶対に書かない — `.env*` は `.gitignore` 済みかつエージェントからの読み取りも拒否設定です。

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret list
```
