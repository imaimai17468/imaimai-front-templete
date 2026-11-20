# デプロイ・ロールバック・シークレット運用

Cloudflare **Workers** へのデプロイと、その後の切り戻し・秘密情報の更新手順。
デプロイは [Void](https://void.cloud) が受け持つ。Worker の名前と互換性の設定は
`void.config.ts` に書いてあり、D1 と R2 はコードの import から Void が推測する
（`void/db` を import すると `DB`、`void/storage` を import すると `STORAGE`）。
初回のデプロイがリソースを作り、その ID を `void.lock.json` に書く。

## デプロイ

```bash
bunx void auth login   # 初回だけ。デプロイ先（Cloudflare か Void のプラットフォーム）を選んでログインする
bun run deploy         # void deploy を実行する
```

デプロイ先は `.void/project.json` に保存され、`--platform cloudflare` か
`--platform void` で上書きできる。初回のデプロイのあとにできる `void.lock.json` は
コミットする。別のマシンや CI からデプロイするときは、このファイルがリソースの
ID を引き継ぐ。

デプロイ前に確認すること:

- `bun run check` と `bun run test` が通っている
- 本番の秘密情報が `void secret put` で登録してある（下記）。`void deploy` は
  `env.ts` が必須とする値がデプロイ先に無いと止まる
- Google OAuth のリダイレクト URI が本番オリジンを含んでいる

`db/migrations/` のマイグレーションは、デプロイのたびに Void がリモート D1 に適用する。
`void deploy` はその前に `db/schema.ts` とマイグレーションの差を読み、新しい
マイグレーションが要る状態なら `bun run db:generate` を求めて止まる。Better Auth は
リクエストのたびに `rate_limits` テーブルを読むので、このテーブルを作るマイグレーションが
当たっていない D1 では `/api/auth/` 以下がすべて 500 を返す。

Void に移る前のデプロイ方法で作った Worker・D1・R2 は引き継がない。Void は新しい
リソースを作り、古いリソースはアカウントに残る。消すときは Cloudflare の
ダッシュボードか wrangler で消す。

## ログ

`void project logs` がデプロイ済み Worker のログを読む。

```bash
bunx void project logs --level error
```

Void のプラットフォームにデプロイしたときは `--range 12h` のように過去の範囲を
選べる（最大 `7d`）。Cloudflare に直接デプロイしたときは、`void.config.ts` の名前の
Worker を流し続けるだけで履歴は読めない。このコマンドはアカウントに届くので、
モデルは実行しない。ログからローカルで再現するまでの手順は
`.claude/skills/prod-logs/SKILL.md` にある。

【要確認】Void が Worker の Workers Logs（`observability`）を有効にするかは
確かめていない。有効なら、Cloudflare ダッシュボードの Observability タブか、
プロジェクト MCP `cloudflare-observability` からも読める。

- Cursor: `.cursor/mcp.json`。初回は Cloudflare の OAuth。ツールは
  `query_worker_observability`、`observability_keys`、`observability_values`
- Claude Code: 同じ URL を `.mcp.json` に `type: http` で置いてある。初回は
  セッションでプロジェクト MCP を承認する

`bun run dev` では同じ `console.error` が開発サーバのターミナルに出る。クライアントへ
返す失敗メッセージは固定文のままで、スタックはログ側にだけ残る。

## ロールバック

```bash
bunx void project rollback             # 直前のデプロイへ戻す
bunx void project rollback <deployId>  # 指定したデプロイへ戻す
```

Cloudflare に直接デプロイしたときで、保存したデプロイ先と違う場合は
`--platform cloudflare` を付ける。【要確認】このリポジトリではまだ一度も実行していない。

**重要な限界**: ロールバックが戻すのは Worker のコードと設定だけで、**D1 の
スキーマは戻らない**。破壊的なマイグレーション（列の削除・型変更・NOT NULL
追加など）を含むデプロイを切り戻す場合は、コードを戻すだけでは不整合が残る。
そうしたマイグレーションは、

1. 先に後方互換な形（列追加のみ・NULL 許容）でデプロイし、
2. コードを切り替え、
3. 十分に安定してから旧列を削除する

という順序に分けること。切り戻しが必要になった時点で選択肢を残すのが目的。
Cloudflare に直接デプロイした D1 は、`void db restore --bookmark <b>` で
デプロイ前の時点へ戻せる（ブックマークはデプロイがマイグレーションの前に表示する）。

## 秘密の渡し方

`env.ts` は `BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を
宣言している。本番の値は名前だけを渡して登録し、値は伏せ字のプロンプトに入力する。

```bash
bunx void secret put BETTER_AUTH_SECRET
bunx void secret put GOOGLE_CLIENT_ID
bunx void secret put GOOGLE_CLIENT_SECRET
bunx void secret list   # 登録済みの名前だけを表示する。値は表示しない
```

**値をコマンドラインに書かないこと。** `void secret put NAME=値` の形は、既定の
シェルでは実値がヒストリファイルに残る。秘密は一時的にもファイルへ書かない。

`void deploy` はローカルの `.env` を読まない。開発用の値が本番に紛れ込むことはない。

## シークレットのローテーション

値を替えるときは `void secret put <名前>` で新しい値を登録する。

対象になる秘密情報:

| 名前 | 発行元 | ローテーション時の注意 |
|---|---|---|
| `BETTER_AUTH_SECRET` | 自前生成 | 変更すると既存セッションが全て無効になる（再ログインが必要） |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | 先に新しいシークレットを発行し、登録後に旧シークレットを失効させる |

`src/lib/auth/better-auth.ts` は `BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` を、`void/env` から読んで認証設定へ**明示的に渡している**。
better-auth 自身のシークレットフォールバックは `process.env` を読み、
Workers が `process.env` を埋めるのは `nodejs_compat_populate_process_env` が有効な
場合（既定になるのは compatibility date が 2025-04-01 以降）に限られる。明示的な
配線はそのフラグの既定値に依存しないので外さないこと。

`void.config.ts` の `worker.compatibility_date` は**Void が同梱する `workerd` が対応する
日付以下**に固定する。今日の日付に更新しない。`workerd` は `void` の依存として
入るので、`void` を上げるときに一緒に上がる。上限は日付を設定して `bun run dev` を
走らせ、対応日付を名指しするエラーを読んで確かめる。

いずれかの値が未設定か空の場合、`buildAuth()` は**例外を投げる**（メッセージに対応する
変数名と、`void secret put` で設定するよう明示）。つまり登録漏れの症状は、
既定値や空の OAuth 設定へのサイレントフォールバックではなく「認証経路が失敗する」。
better-auth 自身の既定シークレット検出は本番判定に `NODE_ENV` を使うが、`NODE_ENV`
は Worker の binding ではないため `process.env` が埋まっても現れず、全環境で作動
しない。

新しい値は登録した時点で Worker に反映される【要確認】。手順は「新しい値を登録
→ 動作確認 → 発行元で旧い値を失効」の順にする。逆順にすると失効から
反映までの間に認証が落ちる。

ローカル開発用の値はルートの `.env`（gitignore 済み・エージェントからの読み取りも
拒否設定）に置く。本番の値をローカルに置く運用にはしない。
