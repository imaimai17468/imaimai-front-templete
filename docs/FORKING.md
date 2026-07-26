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
性質かで扱いを分ける。

**再利用する（そのまま持っていく）**

- `.claude/skills/`, `.claude/agents/`, `.claude/hooks/`, `.claude/rules/` —
  スキル・エージェント定義・ゲート・パススコープのルール
- `.claude/settings.json` — 権限境界（ADR-0004）。プロジェクト固有のコマンドを
  足す場合は `allow` の広さが境界の一部であることに注意
- `docs/superpowers/evals/` — レビュー品質の回帰スイート
- `aegis-share/` — 知識ベースの正本（下記の注意を読むこと）
- `AGENTS.md`, `CLAUDE.md`, `lefthook.yml`, `.oxlintrc.json`, `knip.json`

**このテンプレート固有の履歴（整理してよい）**

- `docs/adr/` — テンプレート自身の意思決定記録。新プロジェクトで意味を持つのは
  一部（例: 0004 権限境界、0016 レイヤ契約）で、移行や運用変更の経緯（0001,
  0003, 0007〜0015）は他人の歴史
- `docs/superpowers/specs/*-design.md`, `docs/superpowers/plans/` — 個々の作業の
  設計メモ
- `specs/` — 実装済み機能の状態機械仕様（書式の参考にはなる）
- `docs/launch-checklist/` の過去レポート（あれば）

**ADR を整理する場合の必須手順**: Aegis の知識ベースは ADR を配送している。
`docs/adr/` を削る・書き換えるときは `aegis-share/source/documents/` の対応
ファイル（と、新規なら `source/edges/`）も揃えたうえで、共有パイプラインを
回す。

```bash
npx -y @fuwasegu/aegis@<pinned> share-format
npx -y @fuwasegu/aegis@<pinned> share-lint
npx -y @fuwasegu/aegis@<pinned> share-materialize
npx -y @fuwasegu/aegis@<pinned> share-export
```

バージョンは `.mcp.json` の pin に合わせる。`doctor` が `in_sync` を報告する
状態を保つこと。ローカル DB がバンドルより古い場合の復旧順序は
`.claude/hooks/session-start-aegis-hydrate.sh` が案内する（materialize を先に
回すとバンドルのバージョンが退行するので順序を守る）。

## 4. 削除するアプリ機能

プロフィール機能（`src/components/features/profile-page/`,
`src/server/fn/profile.ts`, `src/gateways/user/`, `src/entities/user/`,
`src/routes/profile.tsx`, `src/lib/storage/`）は、認証・DB・R2 を通した参照実装
であって要件ではない。不要なら削除する。認証自体を外す場合は
`/remove-db` スキルの手順を確認する。

新しい機能を追加するときのディレクトリ判断は [ADR-0016](./adr/0016-src-layering.md)
と `.claude/rules/react.md` に従う。
