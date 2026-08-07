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
  スキル・エージェント定義・ゲート・ルール（Aegis 契約 + パススコープ）
- `.cursor/rules/` — `.claude/rules/` へのファイル単位 symlink（ADR-0031）。
  実体を置かないこと — コピーはドリフトする（ADR-0026 の教訓）
- `.claude/settings.json` — 権限境界（ADR-0004）。プロジェクト固有のコマンドを
  足す場合は `allow` の広さが境界の一部であることに注意
- `scripts/evals/` — レビュー品質の回帰スイート
- `aegis-share/` — 知識ベースの正本（下記の注意を読むこと）
- `AGENTS.md`, `CLAUDE.md`, `lefthook.yml`, `.oxlintrc.json`, `knip.json`

**このテンプレート固有の履歴（整理してよい）**

- `aegis-share/source/documents/` — テンプレート自身の意思決定記録（ADR）。
  フォーク先に関係するのは「今どう動くか」を説明する ADR だけ（例: 0004 権限境界、
  0016 レイヤ契約）。このテンプレート自身のプロセスがどう変遷したかの記録は他人の
  歴史なので落としてよい。**これはフォーク先という別リポジトリでのみ許される**
  （このリポジトリ内では ADR を削除せず superseded にする / AGENTS.md「ADR form」）。
  消す場合は `source/edges/` の該当エッジも一緒に落とし、share パイプラインを回し直す
- `docs/launch-checklist/` の過去レポート（あれば）

**ADR を整理する場合の必須手順**: 記録は `aegis-share/source/` にしか無い。
`source/documents/adr-NNNN.md` を直接編集し（新規なら `source/edges/` にエッジを
追加、削除するならそのエッジも落とす）、共有パイプラインを回す。

削除する場合は、残す ADR からの参照も先に確認する。
`grep -rn "amended by\|superseded by" aegis-share/source/documents/` で、削除対象を
指している Status 行や本文を洗い出し、書き換えるか「参照先は削除済み」と注記する。
放置すると、残した ADR が存在しない番号を指した状態になる（例: 0004 の Status は
`amended by 0013, 0017`）。

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

新しい機能を追加するときのディレクトリ判断は ADR-0016
と `.claude/rules/react.md` に従う。
