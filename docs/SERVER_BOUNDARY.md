# サーバ境界をどうするか

`createServerFn` を oRPC へ移し、Hono に `/api/*` を持たせるところまで一度実装し、
複雑さが見合わないと判断して戻した（`git log` に revert が残っている）。着手する
なら知っておくべきことをここに置く。**実装記録ではなく、次に始める人向けの前提。**

## いまの形

```
Cloudflare Worker
└ src/ssr.tsx           createStartHandler
    ├ routes/           TanStack Router。api/ は 2 本（auth catch-all, avatars）
    ├ server/fn/        認可境界。createServerFn
    ├ gateways/         D1 / R2
    ├ entities/         zod スキーマ
    └ lib/              drizzle / auth / storage
```

内部のデータ取得に HTTP は介在しない。`createServerFn` は SSR 中にサーバ側で
直接呼ばれるので、自分自身へのリクエストが起きない。

## `createServerFn` の限界

ミドルウェアは十分にある — TanStack Start のミドルウェアは合成可能で型付きコンテキストを
持ち、グローバル登録もできる。ただしこのリポジトリはミドルウェアを一度も使っていない
ので、実例は無い。スケールで困るのはそこではなく 3 点。

- **フレームワーク結合**: TanStack Start 専用。モバイルや外部サービスから呼べない
- **契約が無い**: `.validator()` は任意の関数で、OpenAPI も生成クライアントも出ない
- **面としての構造が無い**: ルータもネームスペースも無く、export された関数の集合

## 目指す形（実装しなかった判断込み）

デプロイを 2 つに割る。**monorepo とデプロイ数は直交する軸**で、アプリ 1 つ
デプロイ 1 つなら `apps/` + `packages/` は儀式になる（Project References は
tsconfig の参照だけで実現できる）。monorepo が働くのはデプロイ物か消費者が
2 つ以上になってから。

```
apps/
├─ web/     Worker。UI と SSR のみ。バインディングも秘密も持たない
└─ bff/     Worker。oRPC 実装 + Better Auth + gateways。D1 / R2 / secret を持つ
packages/
└─ core-contract/   契約のみ（composite）。両方が参照
```

| 経路 | 手段 | ホップ |
|---|---|---|
| ブラウザ → 手続き | bff オリジンへ直接 HTTP | 1 |
| SSR → 手続き | Service Binding（`RPCLink` の `fetch` 差し替え） | 0（同一スレッド） |
| ブラウザ → 認証 | bff オリジンへ直接 | 1 |

**構造上の利点**: web に実装が存在しないので、サーバコードがブラウザへ漏れる経路
自体が消える。単一 Worker のままだと、SSR 用クライアントがルータ実装を import する
ので、防御がビルド時削除だけになる。

### 検証済みの前提

再調査しなくていいように残す。oRPC と Hono の行は移行時にインストールされていた
`@orpc/*` 1.15.0 と `hono` 4.13.3 に対して確認したもので、revert でどちらも入って
いない。ライブラリが変わっている可能性があるので、依拠する前に確かめ直すこと。
Cloudflare と PSL の行は公開情報なので今も確認できる。

| 論点 | 結果 |
|---|---|
| Service Binding の性能 | ネットワークを越えず同一スレッド、関数呼び出しとほぼ同速 |
| oRPC を Service Binding に載せられるか | `RPCLinkOptions` が `LinkFetchClientOptions` を継承し `fetch?` を持つ。アダプタ自作は不要 |
| `*.workers.dev` で subdomain 間 Cookie が張れるか | 張れる。PSL の登録は `workers.dev` 単体でワイルドカードではないので `<account>.workers.dev` が登録可能ドメインになる |
| Hono と TanStack Start の同居 | ルート 1 枚で `app.fetch(request)` に委譲できる。Hono はフルパスでマッチし、クエリ文字列も温存する |
| oRPC のミドルウェアが通る経路 | `createRouterClient`（プロセス内）/ `RPCHandler`（HTTP）/ `call()` の 3 経路すべてで走る |

Cookie は `crossSubDomainCookies: { enabled: true, domain: "<account>.workers.dev" }`。
カスタムドメインは必須ではない。

### 却下した形

- **認証を web に残す** — Better Auth は D1 を要求するので web もバインディングを
  持つことになり、分割の意味が薄れる
- **web が `/api/*` を全部 bff へリバースプロキシ** — Cookie の同一オリジン問題を
  避けられるが、API 呼び出しが 2 ホップになる。プロキシは設計上の美点ではなく
  回避策で、Better Auth のドキュメントも別オリジン時の回避策として挙げているだけ
- **RSC を TanStack Start に載せる** — Start の RSC は「クライアントが fetch・
  キャッシュ・合成するデータのストリーム」として扱う設計で、コンポーネントツリー
  ではない。本来の RSC が欲しいなら噛み合わない。素の React に降りるのは自分が
  フレームワーク作者になる選択（ルーティング、3 エントリ、server action の自作）
- **Hono の `hc` を契約層にする** — Hono リポジトリの issue が型推論の重さを報告して
  いる。CI で 8 分、tsserver が変更ごとに 5〜10 秒、turborepo では RPC の型が
  `unknown` になる既知不具合。いずれもこのプロジェクトでの計測ではない。この
  リポジトリは TypeScript 7 native と tsgolint で型検査を速くしているので、その
  投資を打ち消す

### 未確認

Service Binding の `fetch` が Cookie ヘッダを透過するか。Cloudflare の該当ページに
記述が無い。ただしこの構成ではブラウザが bff と直接話すので、認証経路に Service
Binding を使わない。

## 認可の置き場所

**HTTP 層ではなく手続きの内部に置く。** SSR はプロセス内で手続きへ到達するので、
Hono のミドルウェアに置くとその経路が認可を飛ばす。実装したときに、oRPC の
ミドルウェアが 3 経路すべてで走ることを実測で確認している。

設計を state machine に落として検証したときの結論も同じだった。3 ラウンド回して
分かったのは、**守りたい性質のうち 3 種類は単一呼び出しの機械では表現できない**
こと。

| 性質 | なぜ書けないか | 何が担うべきか |
|---|---|---|
| **由来** — この identity はこの呼び出しが導出したものか | memo された値と新規導出が同じ形で返るので、1 呼び出しから区別できない | テスト（2 つの解決を同時に in-flight にする）と、identity を束縛する層での module-scope 可変状態の禁止 |
| **実装の差分** — ミドルウェアを消したら挙動が変わるか | 「どの実装か」の変数が機械に無い | 非準拠実装に終端状態を与える（`failed` へ落とす行を持つ） |
| **モジュール構造** — router 以外が gateway に触らないか | そういう呼び出しは機械の入口に入らない | lint |

3 番目が重要で、**機械の保証自体がモジュール構造に依存している**。「`authorized` を
通らずに `executed` に到達できない」が成立するのは呼び出しが機械の入口から入る
場合だけで、component が gateway を直接 import したらその外側になる。

## 移行のコスト

一度やったときの実測。

| 対象 | 規模 |
|---|---|
| `src/` | 69 ファイル |
| サーバ処理の全量（テスト除く） | 約 100 行 |
| HTTP エンドポイント | 2 本 |
| `src/` パスをハードコードしている設定 | `vitest.config.mts` / `knip.json` / `tsconfig.json` / `wrangler.toml` / `components.json` / `.oxlintrc.json` |
| `tools/oxlint-plugins/arch-rules.js` のパス依存 | `"src/` を含む行が 54 |

**エンドポイントの移設コストは本数に比例しない。** ハンドラのロジックが
`Request → Response` の純関数として切られていれば、Hono へ寄せるのは殻の差し替えで
済む。いまの `src/routes/api/avatars.ts` はその形になっている。逆に、ルートファイルに
ロジックを直書きし始めると、そこから先は本数に比例する。**明文化されていない規約**
なので、増やすときは気をつける。

`tsconfig.json` の `noEmit: true` は `composite` と衝突するので、パッケージに切る
なら設定を分ける必要がある。`src/ssr.tsx` は JSX を含まないのに `.tsx` なので、
動かすタイミングで `.ts` に直すとよい。
