# デプロイ・ロールバック・シークレット運用

Cloudflare **Workers** へのデプロイと、その後の切り戻し・秘密情報の更新手順。
リソース (Worker / D1 / R2) は `alchemy.run.ts` に宣言してあり、初回の
デプロイが作る。ログインと drizzle-kit 用の値は
[DATABASE_SETUP.md](./DATABASE_SETUP.md) を参照。

## デプロイ

```bash
bunx alchemy profile edit --add Cloudflare   # 初回だけ。OAuth か API トークンでログイン
bun run deploy                               # ステージ live_$USER へデプロイ
bun run deploy --stage prod                  # 名前付きステージへデプロイ
```

`bun run deploy` は `alchemy deploy` を実行する。ログイン情報は
`~/.alchemy/profiles/<プロファイル名>/cloudflare.json` に保存される（プロファイル名は
`ALCHEMY_PROFILE` が無ければ `default`）。`--stage` を省くとステージは
`live_$USER` になるので、本番は `--stage <名前>` を毎回付けて区別する。

`alchemy dev` と違い、デプロイでは Alchemy が状態を Cloudflare アカウントに置く。
最初のデプロイがアカウントに状態の置き場所を作る（`alchemy-state-store` という
名前の Worker と、2 つの秘密を入れたアカウントの Secrets Store）。

Alchemy は既定で利用状況のテレメトリを送る。止めるときは
`ALCHEMY_TELEMETRY_DISABLED=1`（または `DO_NOT_TRACK`）を設定して実行する。

デプロイ前に確認すること:

- `bun run check` と `bun run test` が通っている
- 本番の秘密情報が、`bun run deploy` を実行するシェルの環境変数に入っている（下記）
- Google OAuth のリダイレクト URI が本番オリジンを含んでいる

`src/lib/drizzle/migrations/` のマイグレーションは、デプロイのたびに Alchemy が
リモート D1 に適用し、適用済みのものを自前の `__alchemy_migrations` テーブルに
記録する。Better Auth はリクエストのたびに `rate_limits` テーブルを読むので、
このテーブルを作るマイグレーションが当たっていない D1 では `/api/auth/` 以下が
すべて 500 を返す。

### wrangler で作った既存の本番があるとき

`alchemy.run.ts` はリソースに `name` を付けていないので、Alchemy は名前を
`<スタック名>-<リソース ID>-<ステージ>-<ランダムな接尾辞>` の形で作る（ローカルの
D1 は `my-project-db-dev-<ユーザー名>-<接尾辞>` になった）。初回の `alchemy deploy` は
この名前でリソースを探すので、wrangler で作った既存の Worker・D1・R2 バケットは
見つからず、空の D1 と空のバケットを持つ新しいリソースが並んで作られる見込みで、
本番のデータは移らない【要確認】。既存のリソースを引き継ぐには、各宣言の `name` を
既存の名前にする必要がある。そのとき `--adopt` も要るかは確かめていない。

初めてデプロイする前に `bunx alchemy plan --stage <名前>` を実行し、作成（create）と
出るリソースを読んでから進めること。ただし Alchemy の状態の保存先がまだ無い
アカウントでは、`plan` も保存先（`alchemy-state-store`）をデプロイするか尋ね、
既定の答えは「はい」なので、`plan` もアカウントに書き込む。

D1 については、drizzle-kit・Prisma・wrangler のマイグレーション履歴を持つ
データベースは初回デプロイでその履歴が引き継がれる、と Alchemy のソース
（`node_modules/alchemy/src/Cloudflare/D1/Database.ts`）に書かれている。
【要確認】`drizzle-kit push`（`bun run db:push`）でスキーマだけを当てた D1 は
履歴テーブルを持たないので、Alchemy が先頭からマイグレーションを当てて
`table ... already exists` で止まるかどうかは確かめていない。

## ログ

Alchemy の Worker は、`observability` を指定しなければ Workers Logs を有効にする
（`node_modules/alchemy/src/Cloudflare/Workers/Worker.ts` の既定値）。デプロイ
済み Worker の invocation log、`console.*`、未捕捉例外がそこに入り、Cloudflare
ダッシュボードの Observability タブか、プロジェクト MCP
`cloudflare-observability` から読む。

- Cursor: `.cursor/mcp.json`。初回は Cloudflare の OAuth。ツールは
  `query_worker_observability`、`observability_keys`、`observability_values`
- Claude Code: 同じ URL を `.mcp.json` に `type: http` で置いてある。初回は
  セッションでプロジェクト MCP を承認する

Workers Logs に入るのはデプロイ済み Worker だけである。`bun run dev` では同じ
`console.error` が開発サーバのターミナルに出る。クライアントへ返す失敗メッセージ
は固定文のままで、スタックはログ側にだけ残る。

## ロールバック

【要確認】Alchemy を通した切り戻しの手順は確かめていない。Cloudflare の
ドキュメントは、ダッシュボードの **Workers & Pages** > 対象の Worker >
**Deployments** から、版の右の三点メニューで **Rollback** を選ぶ手順を載せて
いる。ダッシュボードで戻したあと Alchemy の状態がどう扱うかも確かめていない。
次の `bun run deploy` は、そのとき手元にあるコードをデプロイする。

**重要な限界**: ロールバックが戻すのは Worker のコードと設定だけで、**D1 の
スキーマは戻らない**。破壊的なマイグレーション（列の削除・型変更・NOT NULL
追加など）を含むデプロイを切り戻す場合は、コードを戻すだけでは不整合が残る。
そうしたマイグレーションは、

1. 先に後方互換な形（列追加のみ・NULL 許容）でデプロイし、
2. コードを切り替え、
3. 十分に安定してから旧列を削除する

という順序に分けること。切り戻しが必要になった時点で選択肢を残すのが目的。

## 秘密の渡し方

`alchemy.run.ts` は `BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` を `Config.Redacted` で宣言している。`bun run deploy` は
これらを実行したシェルの環境変数から読み、Worker に secret text として
バインドする。3 つとも設定してからデプロイする。

```bash
read -rs BETTER_AUTH_SECRET && export BETTER_AUTH_SECRET     # 値は対話的に入力する
read -rs GOOGLE_CLIENT_ID && export GOOGLE_CLIENT_ID
read -rs GOOGLE_CLIENT_SECRET && export GOOGLE_CLIENT_SECRET
bun run deploy --stage prod
```

**値をコマンドラインに書かないこと。** `BETTER_AUTH_SECRET=... bun run deploy`
の形は、既定のシェルでは実値がヒストリファイルに残る。`read -s` は値を
エコーせずに受け取る。秘密は一時的にもファイルへ書かない。

bun は自分が起動するプロセスにカレントディレクトリの `.env.local` を読み込むので、
シェルで設定しなかった変数には開発用の値が入る。シェルで設定した値はファイルの値より
優先される。開発用の値のままデプロイしないよう、`alchemy.run.ts` はデプロイ（`alchemy dev`
以外）で 3 つのどれかが `.env.local` と同じ値なら、その名前を挙げて止まる。

## シークレットのローテーション

秘密情報はファイルに置かず、`bun run deploy` を実行する環境から渡す。値を
替えるときは、新しい値を環境変数に入れて `bun run deploy` をもう一度実行する。

対象になる秘密情報:

| 名前 | 発行元 | ローテーション時の注意 |
|---|---|---|
| `BETTER_AUTH_SECRET` | 自前生成 | 変更すると既存セッションが全て無効になる（再ログインが必要） |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | 先に新しいシークレットを発行し、登録後に旧シークレットを失効させる |

`src/lib/auth/better-auth.ts` は `BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` を認証設定へ**明示的に渡している**。
better-auth 自身のシークレットフォールバックは `process.env` を読み、
Workers が `process.env` を埋めるのは `nodejs_compat_populate_process_env` が有効な
場合（既定になるのは compatibility date が 2025-04-01 以降）に限られる。現在の
`alchemy.run.ts` の `compatibility.date` はこれを満たすが、明示的な配線はその
フラグの既定値に依存しないので外さないこと。

`alchemy.run.ts` の `compatibility.date` は**インストール済みの `workerd` が対応する
日付以下**に固定する。今日の日付に更新しない。`workerd` は `alchemy` の依存として
入るので、`alchemy` を上げるときに一緒に上げるもので、上限は日付を設定して
`bun run dev` を走らせ、対応日付を名指しするエラーを読んで確かめる。

いずれかの値が未設定の場合、`buildAuth()` は**例外を投げる**（メッセージに対応する
変数名と、`bun run deploy` の環境に設定するよう明示）。つまり登録漏れの症状は、
既定値や空の OAuth 設定へのサイレントフォールバックではなく「認証経路が失敗する」。
better-auth 自身の既定シークレット検出は本番判定に `NODE_ENV` を使うが、`NODE_ENV`
は Worker の binding ではないため `process.env` が埋まっても現れず、全環境で作動
しない。値が空のときはこの throw が、開発用の値のままのときは上の
`alchemy.run.ts` の確認が検出する。開発用でも本番用でもない値（たとえば別の環境の値）
は、どちらも検出しない。

新しい値はデプロイが終わった時点で反映される。手順は「新しい値で
デプロイ → 動作確認 → 発行元で旧い値を失効」の順にする。逆順にすると失効から
反映までの間に認証が落ちる。

ローカル開発用の値は `.env.local`（gitignore 済み・エージェントからの読み取りも
拒否設定）に置く。本番の値をローカルに置く運用にはしない。
