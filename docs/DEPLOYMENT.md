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
`@cloudflare/vite-plugin` が担う（ADR-0007）。

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

## シークレットのローテーション

秘密情報はファイルに置かず `wrangler secret` で管理する（ADR-0017）。

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

`BETTER_AUTH_SECRET` は `src/lib/auth/auth.ts` で `betterAuth({ secret: ... })` に
**明示的に渡している**。better-auth 自身のフォールバックは `process.env` を読むが、
Workers が `process.env` を埋めるのは `nodejs_compat_populate_process_env` が有効な
場合のみ（既定になるのは `compatibility_date` が 2025-04-01 以降）で、この Worker は
2024-12-01 + `nodejs_compat` のみ。明示的に渡さないと登録した値が読まれず、
公開されている既定シークレットで署名され続ける。この配線を外さないこと。

値が未設定の場合、`buildAuth()` は既定シークレットにフォールバックせず**例外を
投げる**（メッセージに `wrangler secret put BETTER_AUTH_SECRET` を明示）。
つまり登録漏れの症状は「認証が静かに脆弱になる」ではなく「認証経路が失敗する」。
better-auth 自身の既定シークレット検出は本番判定に `NODE_ENV` を使い、それも
埋まらない `process.env` から読むため全環境で作動しない。この throw が唯一の
検出手段になる。

`wrangler secret put` は即時反映される（再デプロイ不要）。手順は「新しい値を
登録 → 動作確認 → 発行元で旧い値を失効」の順にする。逆順にすると失効から
反映までの間に認証が落ちる。

ローカル開発用の値は `.env.local`（gitignore 済み・エージェントからの読み取りも
拒否設定）に置く。本番の値をローカルに置く運用にはしない。
