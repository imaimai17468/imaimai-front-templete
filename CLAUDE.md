# Artisense コーディングルール

## プロジェクト概要

### 技術スタック
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (厳格モード, tsgo)
- **Styling**: Tailwind CSS, shadcn/ui
- **Testing**: Vitest, React Testing Library
- **Backend**: Cloudflare D1 + Better Auth + Drizzle ORM
- **Build**: Bun
- **Lint**: oxlint
- **Format**: oxfmt

## 基盤ルール

### コロケーション

関連するコードは近くに置く。距離が離れるほど認知コストが上がる。

- **1ディレクトリ = 1 `.tsx` ファイル**（ディレクトリ名 = コンポーネント名のkebab-case）
- `.tsx` ファイルは全てコンポーネントとみなす — **同一ディレクトリに `.tsx` を2つ以上置かない**
- `.ts` ファイル（関数・型定義）とテストは同階層に配置してよい
- 別の `.tsx` が必要になったら、サブディレクトリを作りそこに置く
- `src/utils/`、`src/helpers/`、`src/__tests__/` などの集約ディレクトリは作成しない

```
features/
  user-profile/
    UserProfile.tsx           # このディレクトリ唯一の .tsx
    formatUserName.ts         # .ts は同階層OK
    formatUserName.test.ts    # テストも同階層OK
    user-avatar/              # 別の .tsx が必要 → サブディレクトリ
      UserAvatar.tsx
      cropImage.ts
      cropImage.test.ts
```

### 関数の品質基準

関数を書く・レビューする際は以下の3点を常に確認する:

1. **イミュータブルか** — 引数や外部の値を変更しない。新しい値を返す
2. **関数型か** — `for`/`while`/`push` ではなく `map`/`filter`/`flatMap`/`reduce` を使う
3. **型推論が効くか** — 冗長な型注釈・`as` キャスト・`!` (non-null assertion) を避け、type predicate や `flatMap` で型を絞り込む
4. **`let` を使わない** — `const` + 三項演算子・即時関数・`tr.steps.length` チェック等で置き換える。useEffect クリーンアップフラグや TipTap 拡張状態など構造上必須な場合のみ例外

### ホワイトボックステスト

条件分岐・副作用のロジックをコンポーネントから純粋関数として抽出し、テスト可能にする。

- **すべての表示状態をprops経由で制御可能にする**（内部stateで分岐しない）
- **useEffect/イベントハンドラ内の条件分岐は純粋関数に抽出する**（クロージャ変数への依存を排除）
- 抽出した関数は同階層にファイル化し、単体テストを書く
- **`test()` を使う** — `it()` は使わない（Vitest のエイリアスだが `test` に統一）
- **Mock 禁止** — 純粋関数のテストでは全て実引数を渡す
- **v8 が到達不能ブランチをカウントする場合、テスト側ではなくコード側を変更する**:
  - `?? fallback` が多い → 元の関数が fallback を返すように変更し `??` を除去
  - クロージャ内のロジック → 純粋関数として export し直接テスト可能にする
  - 型で網羅済みの `switch default` → 全 case を switch に入れ `default` を削除

### Better Auth サーバーサイド API

`auth.api` で Server Component / Server Action からセッション・組織・招待等を取得できる。`headers()` を渡す必要がある。

```typescript
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

// Server Component で直接呼べる
const orgData = await auth.api.getFullOrganization({
  headers: await headers(),
  query: { organizationId },
});
```

- **データ取得は Server Component で `auth.api` を使う**（DB 直接クエリで二重実装しない）
- **クライアントでの更新後は `router.refresh()` で Server Component を再実行**
- `authClient`（`better-auth/react`）はクライアント専用 — 招待送信・メンバー削除などの mutation に使う

### DB操作

```bash
bun run db:generate                # マイグレーションSQL生成
bun run db:push                    # リモートDBにスキーマ反映
bun run db:push:local              # ローカルDBにスキーマ反映
bun run db:seed:local              # ローカルDBにシードデータ投入
bun run db:studio                  # Drizzle Studio（DBブラウザ）起動
bun run db:pull                    # リモートDBからスキーマ取得
```

### 本番環境

- **本番 URL**: `https://artisense.org`
- **ホスティング**: Cloudflare Pages + D1
- `drizzle-kit push` がインデックス競合で失敗する場合、Wrangler で直接 SQL を実行する:
  ```bash
  npx wrangler d1 execute artisense --remote --command "CREATE TABLE IF NOT EXISTS ..."
  ```

### CLI パッケージ (`cli/`)

npm パッケージ名: `artisense`（`npx artisense` で実行可能）

```bash
# ビルド → バージョンバンプ → 公開
cd cli
bun build src/index.ts --outdir dist --target node
npm version patch
npm publish --access public
```

- npm の 2FA はパスキー（指紋）のため、CLI から `--otp` が使えない。**Granular Access Token (2FA bypass 有効)** で publish する
- `DEFAULT_BASE_URL` は `cli/src/config.ts` で `https://artisense.org` に設定済み

### 日付の取得

今日の日付が必要な場合は `date +%Y-%m-%d` コマンドで取得する。推測や知識に頼らない。

### 作業完了時の確認

コード変更後は以下のコマンドを実行し、問題がないことを確認する。

```bash
bun run check                    # lint (oxlint) + format (oxfmt)
bun run typecheck                # 型チェック (tsgo)
bun run test                     # テスト (vitest)
similarity-ts src                # 類似コード検出
npx knip                         # 未使用エクスポート・依存の検出
```
