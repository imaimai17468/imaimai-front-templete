# データベースセットアップ

> D1 と R2 は `alchemy.run.ts` に宣言してあります。`bun run dev`（`alchemy dev`）は Cloudflare のアカウントもログインも無しにローカルの D1 / R2 を動かし、状態とデータを `.alchemy/`（gitignore 済み）に置きます。**本番 Cloudflare にデプロイする場合**のみ、以下の手順でログインと値の設定を行ってください。

## 1. Cloudflare にログイン

```bash
bunx alchemy profile edit --add Cloudflare
```

OAuth か API トークンを選び、ログイン情報は `~/.alchemy/profiles/<プロファイル名>/cloudflare.json` に保存されます（プロファイル名は `ALCHEMY_PROFILE` が無ければ `default`）。

## 2. リソースを作成

D1 データベースと R2 バケットは、最初の `bun run deploy` が `alchemy.run.ts` の宣言（`Cloudflare.D1.Database("db")` と `Cloudflare.R2.Bucket("avatars")`）から作ります。名前や ID を設定ファイルに書き写す手順はありません。手順は [DEPLOYMENT.md](./DEPLOYMENT.md) を参照してください。wrangler で作った既存のリソースがある場合の注意も同じ文書にあります。

## 3. 環境変数を設定

`bun run setup` が用意する `.env.local` を編集：

```env
# Better Auth
# (Better Auth がリクエストの origin を base URL にするので BETTER_AUTH_URL は無い)
BETTER_AUTH_SECRET=<openssl rand -base64 32 で生成>

# OAuth Providers
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Cloudflare D1 (drizzle-kit用)
DRIZZLE_D1_ACCOUNT_ID=<your-account-id>
DRIZZLE_D1_DATABASE_ID=<your-d1-database-id>
DRIZZLE_D1_API_TOKEN=<your-api-token>

```

### BETTER_AUTH_SECRET の生成

```bash
openssl rand -base64 32
```

### DRIZZLE_D1_ACCOUNT_ID の取得

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Workers & Pages** をクリック
3. 右サイドバーに表示される **Account ID** をコピー

### DRIZZLE_D1_DATABASE_ID の取得

手順2のデプロイで作られた D1 データベースの ID。Cloudflare Dashboard の **Workers & Pages** > **D1** で、対象のデータベースを開くと表示されます。

### Cloudflare API Token の作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) でAPIトークンを作成
2. 「カスタムトークンを作成」を選択
3. 必要な権限は **Account > D1 > Edit** のみ。

このトークンを使うのは drizzle-kit の `d1-http` ドライバ (`db:push` /
`db:generate` / `db:pull` / `db:studio`) だけで、D1 以外の権限は不要。D1 と R2 の
作成は `bun run deploy` が Alchemy のログインで行い、このトークンは使わない。
変数名を `CLOUDFLARE_*` にしていないのは、Alchemy が `CLOUDFLARE_ACCOUNT_ID` と
`CLOUDFLARE_API_TOKEN` をログイン情報より先に読むので、D1 しか触れないこの
トークンがデプロイに使われてしまうからである。権限を
最小に保つこと自体がこのトークンをディスクに置く唯一の
緩和策になっている。秘密をディスクに置かない原則の唯一の例外として許容しているもので、
常設ではない — リモートスキーマ作業が終わったら削除するかローテーションし、タスクの間に
置いたままにしない。

R2 バケットは非公開のまま使用します。アバターは認証と所有権確認を行う
`/api/avatars` 経由で配信するため、公開エンドポイントやカスタムドメインを
バケットへ設定しないでください。

## 4. OAuth認証を設定

### 開発用ログイン

`/login` には「Sign in With Google」ボタンが 1 つだけ並びます。`bun run dev` で立てた開発ビルドでは、このボタンが Google へ飛ばずに `src/lib/auth/sign-in/dev.ts` が持つ資格情報でサインインし、ローカル D1 にそのユーザーが居なければ作ってから入ります。`.alchemy/` を消しても次のクリックで作り直されます。Google の認証情報を登録しなくても認証済みの画面を触れるので、下の Google 設定はデプロイ先を用意する段で行えば足ります。

開発ビルドから Google 側を試すときは `VITE_GOOGLE_SIGN_IN=1 PORTLESS=0 bun run dev` で起動します。同じボタンがそのまま Google へ飛びます。

この差し替えとメール・パスワード認証は本番ビルドでは働きません。Vite が `import.meta.env.DEV` を `false` に畳むので、デプロイされた Worker の `/api/auth/sign-in/email` は `EMAIL_PASSWORD_DISABLED` を返します。

メール・パスワードが使う `accounts.password` 列は drizzle スキーマに入っているので、既にある D1 にはマイグレーションを当ててから使ってください。ローカルなら `bun run dev` を起動し直すと Alchemy が当て、デプロイ先なら手順5のとおり `bun run deploy` が当てます。drizzle は全列を名指しで SELECT するため、列が無い D1 では Google ログインの account 参照も落ちます。当てる前に押してしまい `User already exists.` が出続ける場合は、下の[ローカルデータのリセット](#ローカルデータのリセット)で作りかけの行ごと消してください。

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) > **APIとサービス** > **認証情報**
2. **認証情報を作成** > **OAuthクライアントID** を選択
3. アプリケーションの種類: **ウェブアプリケーション**
4. **承認済みの JavaScript 生成元** に以下を追加:
   - `http://localhost:5173`（開発時）
5. **承認済みのリダイレクト URI** に以下を追加:
   - `http://localhost:5173/api/auth/callback/google`（開発時）

   Google はリダイレクト URI のホストに [Public Suffix List](https://publicsuffix.org/) 上の TLD か `localhost` そのものを要求するので、portless の `http://my-app.localhost:1355` は登録できません。Google ログインを確認するときは `VITE_GOOGLE_SIGN_IN=1 PORTLESS=0 bun run dev` で起動し、`http://localhost:5173` で行います。`PORTLESS=0` が portless を外し、`VITE_GOOGLE_SIGN_IN=1` が ボタンを開発用ログインから Google へ戻します。
6. 作成後、Client ID / Client Secret を `.env.local` に設定

> **本番環境**: 生成元とリダイレクト URI にデプロイ先の Workers オリジンも追加してください。カスタムドメインを使わない場合、既定のオリジンは `<Worker名>.<アカウントサブドメイン>.workers.dev` です。
> - 生成元: `https://<Worker名>.<アカウントサブドメイン>.workers.dev`
> - リダイレクト URI: `https://<Worker名>.<アカウントサブドメイン>.workers.dev/api/auth/callback/google`

## 5. データベースを初期化

スキーマを変えたら、マイグレーションファイルを生成します。

```bash
bun run db:generate
```

生成先は `src/lib/drizzle/migrations/` で、`alchemy.run.ts` の `migrations` がこのディレクトリを指しています。Alchemy は適用済みのマイグレーションを D1 の `__alchemy_migrations` テーブルに記録し、まだ当たっていないものだけを当てます。

### ローカル D1（開発用）

`bun run dev` の起動時に Alchemy が当てます。既存のローカルデータは、Alchemy が見る Cloudflare アカウント（`CLOUDFLARE_ACCOUNT_ID`、無ければログイン中のプロファイルのアカウント）が変わらない限り残ります。ログインなどでアカウントが変わると、新しい空のローカル D1 が作られる見込みです【要確認】。

### リモート D1（本番・ステージング）

`bun run deploy` が当てます。

`bun run db:push`（`drizzle-kit push`）はスキーマを直接リモート D1 に書き、`__alchemy_migrations` には記録しません。【要確認】このため、push で当てた変更を含むマイグレーションを次のデプロイが当て直し、`already exists` で止まると推定していますが、確かめていません。Alchemy が管理する D1 にはデプロイ経由で当ててください。

## 6. 動作確認

### 開発サーバー（日常的な開発）

```bash
bun run dev
```

`bun run dev` は `alchemy dev` を実行し、ローカルの D1/R2 バインディングが使えます。HMR が有効なので日常的な開発にはこちらを使用してください。

| コマンド | ポート | DB/ストレージ | HMR | 用途 |
|---------|--------|-------------|-----|------|
| `bun run dev` | portless が割り当て（`http://my-app.localhost:1355`） | ローカルD1/R2 | ○ | 日常的な開発 |
| `VITE_GOOGLE_SIGN_IN=1 PORTLESS=0 bun run dev` | 5173 | ローカルD1/R2 | ○ | Google ログインの確認 |

### ローカルデータのリセット

`bun run dev` を止めてから `.alchemy/` を消し、もう一度起動します。起動時にマイグレーションが当たり直します。

```bash
rm -rf .alchemy
bun run dev
```

## 補足：Drizzleコマンド

スキーマ変更時に使用：

```bash
# スキーマからマイグレーション生成
bun run db:generate

# スキーマをリモート D1 に直接反映（手順5の注意を参照）
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

- **秘密でない値**: `alchemy.run.ts` の `env` に置き、コミットする。
- **秘密の値**（`BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_SECRET` など）: `bun run deploy` を実行するシェルの環境変数から渡す。ファイルには絶対に書かない。`.env*` は `.gitignore` 済みかつエージェントからの読み取りも拒否設定です。渡し方は [DEPLOYMENT.md](./DEPLOYMENT.md) の「秘密の渡し方」を参照してください。
