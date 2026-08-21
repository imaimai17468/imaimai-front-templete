# このテンプレートを新規プロジェクトに使う

clone した直後に置き換えるべき値と、残す/捨てるファイルの判断。

## 1. プロジェクト識別子を置き換える

初期状態では2箇所のプレースホルダが**互いに不一致**なので、新しい名前で揃える。

| 場所 | 初期値 | 置き換える値 |
|---|---|---|
| `package.json` の `name` | `my-app` | プロジェクト名 |
| `wrangler.toml` の `name` | `my-project` | Worker 名（デプロイ先の識別子） |
| `LICENSE` の著作権表記 | テンプレート作者名 | 自分または自組織 |
| `README.md` の見出しと説明 | テンプレートの説明 | プロジェクトの説明 |

`wrangler.toml` の `name` はデプロイ先の Worker を決めるので、既存の Worker と
衝突しない名前にする。

## 2. Cloudflare リソースを差し替える

`wrangler.toml` は初期状態でローカル開発用のダミー値（`local-db` /
`local-avatars` / ゼロ UUID）が入っており、`bun run dev` はそのまま動く。
本番にデプロイする段で実リソースへ差し替える。手順は
[DATABASE_SETUP.md](./DATABASE_SETUP.md)、デプロイ後の運用は
[DEPLOYMENT.md](./DEPLOYMENT.md) を参照。

`BETTER_AUTH_URL` はローカルが `http://localhost:5173`、本番は本番オリジン。

## 3. 残すもの / 捨てるもの

このリポジトリはアプリ本体より**エージェント運用層のほうが大きい**。どちらの
性質かで扱いを分ける。個別に覚えるものではない — 判定は下の一行で足りる。

**再利用する（そのまま持っていく）**: 規約とゲートを成立させているもの全部。
規約そのもの（`AGENTS.md`, `CLAUDE.md`, `.claude/`）、それを機械的に強制する側
（`lefthook.yml`, `.oxlintrc.json`, `.oxfmtrc.json`, `knip.json`,
`vitest.config.mts`, `tools/oxlint-plugins/`, `scripts/` のゲートスクリプト）、
レビュー品質の回帰スイート（`scripts/evals/`）。規約は文書だけに書かれている
わけではないので、強制側を置いていくと規約が黙って効かなくなる。

個別に注意が要るのは 2 つだけ:

- `.cursor/rules/` — `.claude/rules/` へのファイル単位 symlink。
  実体を置かないこと — コピーはドリフトする
- `.claude/settings.json` — 権限境界。プロジェクト固有のコマンドを
  足す場合は `allow` の広さが境界の一部であることに注意

**このテンプレート固有の履歴（整理してよい）**: 実行日時点の記録として書かれた
もの。skill が日付名で書き出したレポート（`docs/` 配下に skill ごとのディレクトリ
ができる）と、`scripts/evals/` の過去の計測結果（`results/`）。どちらもフォーク先
には関係しない。

このテンプレートは意思決定記録を別立てで持たない。ある判断が「なぜ今こうなって
いるか」は、規約そのもの（AGENTS.md / `.claude/rules/`）と `git log` にある。

## 4. 削除するアプリ機能

プロフィール機能（`src/components/features/profile-page/`,
`src/server/fn/profile.ts`, `src/gateways/user/`, `src/entities/user/`,
`src/routes/profile.tsx`, `src/lib/storage/`）は、認証・DB・R2 を通した参照実装
であって要件ではない。不要なら削除する。認証自体を外す場合は
`/remove-db` スキルの手順を確認する。

新しい機能を追加するときのディレクトリ判断は AGENTS.md の `Rules` 節
と `.claude/rules/react.md` に従う。
