# デプロイ・ロールバック・シークレット運用

Cloudflare **Workers** へのデプロイと、その後の切り戻し・秘密情報の更新手順。
リソース (D1 / R2) の作成と `wrangler.toml` の設定は
[DATABASE_SETUP.md](./DATABASE_SETUP.md) を参照。

## デプロイ

```bash
bun run deploy
```

`vite build && wrangler deploy` を実行する。ビルド成果物ではなく
`wrangler.toml` の `main`（`./src/ssr.tsx`）がエントリで、Cloudflare 連携は
`@cloudflare/vite-plugin` が担う。

デプロイ前に確認すること:

- `bun run check` と `bun run typecheck` と `bun run test` が通っている
- 本番の秘密情報が `wrangler secret` に登録済み（下記）
- Google OAuth のリダイレクト URI が本番オリジンを含んでいる
- `BETTER_AUTH_URL` が本番オリジンになっている（`wrangler.toml` の `[vars]`）

## デプロイ状況の確認

```bash
wrangler deployments list   # 直近のデプロイ一覧
wrangler versions list      # 直近のバージョン一覧（Version ID を取得する）
```

## ロールバック

```bash
wrangler rollback                  # 直前のバージョンへ戻す
wrangler rollback <VERSION_ID>     # 指定バージョンへ戻す
```

`<VERSION_ID>` は `wrangler versions list` で確認する。引数を省略すると最新の
1つ前が対象になる。

**重要な限界**: ロールバックが戻すのは Worker のコードと設定だけで、**D1 の
スキーマは戻らない**。破壊的なマイグレーション（列の削除・型変更・NOT NULL
追加など）を含むデプロイを切り戻す場合は、コードを戻すだけでは不整合が残る。
そうしたマイグレーションは、

1. 先に後方互換な形（列追加のみ・NULL 許容）でデプロイし、
2. コードを切り替え、
3. 十分に安定してから旧列を削除する

という順序に分けること。切り戻しが必要になった時点で選択肢を残すのが目的。

## 秘密の初期登録（デプロイより先に）

`wrangler.toml` の `[secrets]` に列挙した名前は `required` 扱いなので、未登録の
まま `wrangler deploy` すると失敗する。名前を宣言する前に登録を済ませる、という
順序を守れば済む。

Worker がまだ存在しない場合も同じ順序でよい。`wrangler secret put` は登録先が
無いことを検出すると、プレースホルダの Worker を作ってよいか尋ね、承諾すれば
それを作ってから登録する。デプロイを先に済ませる必要はない。

```bash
wrangler secret put BETTER_AUTH_SECRET     # 値は対話的に入力する
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
bun run deploy
```

**値をコマンドラインに書かないこと。** `wrangler secret put` は値を対話的に受け取り
エコーもしない。`wrangler secret bulk` に JSON をパイプする形は、既定のシェルでは
実値がヒストリファイルに残るので使わない（秘密は一時的にもファイルへ書かない）。同じ理由で `wrangler deploy --secrets-file <path>` も使わない。

秘密を**後から追加**する場合も順序は同じ。`[secrets]` に名前を足す前に登録する。
逆順にすると、既存 Worker のデプロイが必須チェックで失敗する。

## シークレットのローテーション

秘密情報はファイルに置かず `wrangler secret` で管理する。

```bash
wrangler secret list                        # 登録済みの名前を確認（値は出ない）
wrangler secret put BETTER_AUTH_SECRET      # 対話的に新しい値を入力
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret delete <NAME>               # 不要になった名前を削除
```

対象になる秘密情報:

| 名前 | 発行元 | ローテーション時の注意 |
|---|---|---|
| `BETTER_AUTH_SECRET` | 自前生成 | 変更すると既存セッションが全て無効になる（再ログインが必要） |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | 先に新しいシークレットを発行し、登録後に旧シークレットを失効させる |

`src/lib/auth/auth.ts` は `BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` を認証設定へ**明示的に渡している**。
better-auth 自身のシークレットフォールバックは `process.env` を読み、
Workers が `process.env` を埋めるのは `nodejs_compat_populate_process_env` が有効な
場合（既定になるのは `compatibility_date` が 2025-04-01 以降）に限られる。現在の
`compatibility_date` はこれを満たすが、明示的な配線はそのフラグの既定値に依存しない
ので外さないこと。

`compatibility_date` は**インストール済みの `workerd` が対応する最新の日付**に固定する。
今日の日付に更新しない。`wrangler` を上げるときに一緒に上げるもので、上限は日付を設定して
`bun run dev` を走らせ、対応日付を名指しするエラーを読んで確かめる。変更後は
`bun run cf-typegen` を走らせる。

いずれかの値が未設定の場合、`buildAuth()` は**例外を投げる**（メッセージに対応する
`wrangler secret put <NAME>` を明示）。つまり登録漏れの症状は、既定値や空の OAuth
設定へのサイレントフォールバックではなく「認証経路が失敗する」。
better-auth 自身の既定シークレット検出は本番判定に `NODE_ENV` を使うが、`NODE_ENV`
は Worker の binding ではないため `process.env` が埋まっても現れず、全環境で作動
しない。この throw が唯一の検出手段になる。

`wrangler secret put` は即時反映される（再デプロイ不要）。手順は「新しい値を
登録 → 動作確認 → 発行元で旧い値を失効」の順にする。逆順にすると失効から
反映までの間に認証が落ちる。

ローカル開発用の値は `.env.local`（gitignore 済み・エージェントからの読み取りも
拒否設定）に置く。本番の値をローカルに置く運用にはしない。
