# データベースセットアップ

> D1 と R2 は [Void](https://void.cloud) が受け持ちます。`void/db` を import するコードがあるので `DB`（D1）が、`void/storage` を import するコードがあるので `STORAGE`（R2）が、それぞれ Worker に結び付きます。`bun run dev` は Cloudflare のアカウントもログインも無しにローカルの D1 / R2 を動かし、データを `.void/`（gitignore 済み）に置きます。**本番 Cloudflare にデプロイする場合**のみ、[DEPLOYMENT.md](./DEPLOYMENT.md) の手順でログインと秘密の登録を行ってください。

## 1. 環境変数を設定

`bun run setup` がルートに用意する `.env` を編集します。Void が読むローカルの値はこのファイルだけで、`.env.local` など他の名前の dotenv ファイルがルートにあると `bun run dev` は起動を止めます。どの名前が要るかは `env.ts` が宣言しています。

`bun run dev` は `env.ts` に無い名前も Worker の環境に渡します。`BETTER_AUTH_URL` や `NEXT_PUBLIC_BETTER_AUTH_URL` が残っていると Better Auth はその値を base URL にし、開発サーバのオリジンからのサインインを `403 Invalid origin` で断ります。

```env
# Better Auth
# (Better Auth がリクエストの origin を base URL にするので BETTER_AUTH_URL は無い)
BETTER_AUTH_SECRET=<openssl rand -base64 32 で生成>

# OAuth Providers
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### BETTER_AUTH_SECRET の生成

```bash
openssl rand -base64 32
```

R2 バケットは非公開のまま使用します。アバターは認証と所有権確認を行う
`/api/avatars` 経由で配信するため、公開エンドポイントやカスタムドメインを
バケットへ設定しないでください。

## 2. OAuth認証を設定

### 開発用ログイン

`/login` には「Sign in With Google」ボタンが 1 つだけ並びます。`bun run dev` で立てた開発ビルドでは、このボタンが Google へ飛ばずに `src/lib/auth/sign-in/dev.ts` が持つ資格情報でサインインし、ローカル D1 にそのユーザーが居なければ作ってから入ります。`.void/` を消しても次のクリックで作り直されます。Google の認証情報を登録しなくても認証済みの画面を触れるので、下の Google 設定はデプロイ先を用意する段で行えば足ります。

開発ビルドから Google 側を試すときは `VITE_GOOGLE_SIGN_IN=1 PORTLESS=0 bun run dev` で起動します。同じボタンがそのまま Google へ飛びます。

この差し替えとメール・パスワード認証は本番ビルドでは働きません。Vite が `import.meta.env.DEV` を `false` に畳むので、デプロイされた Worker の `/api/auth/sign-in/email` は `EMAIL_PASSWORD_DISABLED` を返します。

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) > **APIとサービス** > **認証情報**
2. **認証情報を作成** > **OAuthクライアントID** を選択
3. アプリケーションの種類: **ウェブアプリケーション**
4. **承認済みの JavaScript 生成元** に以下を追加:
   - `http://localhost:5173`（開発時）
5. **承認済みのリダイレクト URI** に以下を追加:
   - `http://localhost:5173/api/auth/callback/google`（開発時）

   Google はリダイレクト URI のホストに [Public Suffix List](https://publicsuffix.org/) 上の TLD か `localhost` そのものを要求するので、portless の `http://my-app.localhost:1355` は登録できません。Google ログインを確認するときは `VITE_GOOGLE_SIGN_IN=1 PORTLESS=0 bun run dev` で起動し、`http://localhost:5173` で行います。`PORTLESS=0` が portless を外し、`VITE_GOOGLE_SIGN_IN=1` が ボタンを開発用ログインから Google へ戻します。
6. 作成後、Client ID / Client Secret を `.env` に設定

> **本番環境**: 生成元とリダイレクト URI にデプロイ先の Workers オリジンも追加してください。カスタムドメインを使わない場合、既定のオリジンは `<Worker名>.<アカウントサブドメイン>.workers.dev` です。
> - 生成元: `https://<Worker名>.<アカウントサブドメイン>.workers.dev`
> - リダイレクト URI: `https://<Worker名>.<アカウントサブドメイン>.workers.dev/api/auth/callback/google`

## 3. スキーマとマイグレーション

スキーマは `db/schema.ts` にあり、`src/` からは `@schema` で import します。スキーマを変えたら、マイグレーションファイルを生成してコミットします。

```bash
bun run db:generate
```

生成先は `db/migrations/` で、`meta/` のスナップショットも一緒にコミットします。`void db generate` は次の差分をこのスナップショットとの比較で作るので、手で書いた SQL だけを置くと同じテーブルを作るマイグレーションがもう一度生成されます。

### ローカル D1（開発用）

`bun run dev` の起動時に Void がまだ当たっていないマイグレーションを当てます。開発サーバを止めずに当てるときは `bun run db:migrate` を使います。

### リモート D1（本番・ステージング）

`bun run deploy` が当てます。

## 4. 動作確認

### 開発サーバー（日常的な開発）

```bash
bun run dev
```

`bun run dev` は Void の Vite プラグインを載せた `vp dev` を実行し、ローカルの D1/R2 バインディングが使えます。HMR が有効なので日常的な開発にはこちらを使用してください。

| コマンド | ポート | DB/ストレージ | HMR | 用途 |
|---------|--------|-------------|-----|------|
| `bun run dev` | portless が割り当て（`http://my-app.localhost:1355`） | ローカルD1/R2 | ○ | 日常的な開発 |
| `VITE_GOOGLE_SIGN_IN=1 PORTLESS=0 bun run dev` | 5173 | ローカルD1/R2 | ○ | Google ログインの確認 |

### ローカルデータのリセット

ローカル D1 を空にしてマイグレーションを当て直します。

```bash
bunx void db reset --yes
```

R2 も含めて消すときは、`bun run dev` を止めてから `.void/` を消し、もう一度起動します。

## 補足：データベースのコマンド

```bash
# スキーマからマイグレーション生成
bun run db:generate

# まだ当たっていないマイグレーションをローカル D1 に当てる
bun run db:migrate

# データベースGUIを起動（ローカル D1）
bun run db:studio
```

## 補足：デプロイ

Cloudflare Workersへのデプロイ：

```bash
bun run deploy
```

このプロジェクトのデプロイ先は Cloudflare **Workers** です（Pages ではありません）。本番環境の値は種類で置き場所が変わります。

- **秘密でない値**: `void.config.ts` の `worker.vars` に置き、コミットする。
- **秘密の値**（`BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_SECRET` など）: `env.ts` に名前を宣言し、`void secret put` で登録する。ファイルには絶対に書かない。`.env*` は `.gitignore` 済みかつエージェントからの読み取りも拒否設定です。渡し方は [DEPLOYMENT.md](./DEPLOYMENT.md) の「秘密の渡し方」を参照してください。
