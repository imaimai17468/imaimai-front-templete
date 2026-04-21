---
name: remove-db
description: DB・認証・ストレージ機能をテンプレートから除去する。Cloudflare D1 / R2 / Better Auth / Drizzle ORM を使わないプロジェクトに転用する際に使用。
user_invocable: true
---

# Remove DB / Auth / Storage

このテンプレートから以下の機能を完全に除去する手順:

- Cloudflare D1 (Drizzle ORM)
- Cloudflare R2 (ストレージ)
- Better Auth (Google OAuth)
- `@opennextjs/cloudflare` (Cloudflare Workers デプロイ)

`docs/DATABASE_SETUP.md` で入れた構成をまるごと巻き戻すイメージ。フロントだけのテンプレートとして使いたい時に実行する。

---

## 前提確認

- 対象ブランチに重要な未コミット変更がないこと (`git status` でクリーン)
- 変更範囲が広いため、作業前にブランチを切ることを推奨

---

## 1. ソースコードを削除

### ディレクトリ削除

```bash
rm -rf src/lib/auth
rm -rf src/lib/drizzle
rm -rf src/lib/storage
rm -rf src/actions
rm -rf src/entities
rm -rf src/gateways
rm -rf src/repositories 2>/dev/null || true
rm -rf src/app/api/auth
rm -rf src/app/api/avatars
rm -rf src/app/auth
rm -rf src/app/login
rm -rf src/app/profile
rm -rf src/components/features/profile-page
```

### 単一ファイル削除

```bash
rm -f src/lib/auth.ts
rm -f src/middleware.ts
rm -f src/env.d.ts
```

### `src/app/api/` が空になれば削除

```bash
rmdir src/app/api 2>/dev/null || true
```

---

## 2. 認証依存の UI を修正

### Header 配下の auth 関連を削除

```bash
rm -rf src/components/shared/header/auth-navigation
rm -rf src/components/shared/header/user-menu
```

### `src/components/shared/header/Header.tsx` を修正

`async` / `fetchCurrentUser` / `AuthNavigation` を除去し、同期コンポーネントに戻す:

```tsx
import Link from "next/link";
import { ModeToggle } from "@/components/shared/mode-toggle/ModeToggle";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-transparent backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-6">
        <div>
          <h1 className="font-medium text-2xl">
            <Link href="/">Title</Link>
          </h1>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/link1" className="text-gray-400 text-sm">
            Link1
          </Link>
          <Link href="/link2" className="text-gray-400 text-sm">
            Link2
          </Link>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
};
```

### `src/app/layout.tsx` を確認

現テンプレートの `layout.tsx` は auth 関連 Provider を含んでいないため修正不要。`SessionProvider` 等を追加で導入していた場合は外す。Header を `async` から同期に戻したので import 部分もそのままでよい。

### `src/app/page.tsx` を確認

ログイン状態での分岐・`fetchCurrentUser` 呼び出しがあれば削除し、静的な内容に置き換える:

```bash
grep -n "fetchCurrentUser\|session\|auth" src/app/page.tsx
```

### 残りの auth 参照を網羅的に確認

```bash
grep -rn "auth\|signIn\|signOut\|session\|fetchCurrentUser\|AuthNavigation\|UserMenu" src/
```

ヒットした箇所を個別に除去する。

---

## 3. 設定ファイルを削除 / 更新

### 削除

```bash
rm -f wrangler.toml
rm -f drizzle.config.ts
rm -f open-next.config.ts
rm -rf scripts
rm -rf .wrangler
rm -f docs/DATABASE_SETUP.md
rm -f .env.local.example
rm -f .env.local
```

`docs/` が空になれば `rmdir docs`。

### `next.config.mjs` を更新

`initOpenNextCloudflareForDev()` 呼び出しを削除し、素の Next.js 設定に戻す:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

---

## 4. `package.json` を更新

### 依存関係を削除

```bash
bun remove \
  better-auth \
  drizzle-orm \
  drizzle-kit \
  @opennextjs/cloudflare \
  wrangler \
  dotenv
```

### scripts から以下を削除

- `db:generate`, `db:push`, `db:studio`, `db:pull`, `db:push:local`, `db:seed:local`
- `preview`, `deploy`

`dev` / `build` / `start` / `lint` / `format*` / `typecheck` / `test` / `knip` のみ残す。

---

## 5. README / AGENTS.md / CLAUDE.md を更新

`README.md` から以下の記述を削除:

- **技術スタック** から `Better Auth` / `Cloudflare D1` / `Cloudflare R2` / `@opennextjs/cloudflare`
- **Cloudflare + Better Auth のセットアップ** セクション全体
- **プロジェクト構成** の `entities/` / `gateways/` / `repositories/` / `lib/auth/` / `lib/drizzle/` / `lib/storage/`
- **参考リンク** の Better Auth / Cloudflare 関連
- `next.config.mjs` の Cloudflare バインディング注記
- `bun run preview` / `bun run deploy` / `db:*` スクリプトの記載

`AGENTS.md` / `CLAUDE.md` からも同様に Cloudflare D1 / Better Auth / Drizzle ORM の記述を除去。

---

## 6. 残存参照を確認

以下の検索で何もヒットしないこと:

```bash
grep -r "better-auth\|drizzle\|wrangler\|opennextjs\|cloudflare\|D1Database\|R2Bucket" src/ next.config.mjs package.json README.md AGENTS.md CLAUDE.md
```

ヒットした場合は個別に対応する。

---

## 7. 動作確認

```bash
bun install
bun run typecheck
bun run lint
bun run knip
bun run build
bun run dev
```

- `typecheck` でエラーが出る場合は削除し漏れた import を修正
- `knip` で未使用依存が出たら `bun remove` で追加削除
- ブラウザで `http://localhost:3000` を開きエラーなく表示されることを確認

---

## 8. コミット

機能単位に分けてコミット (`/commit` skill を使う想定):

1. `chore: DB/認証/ストレージ依存を削除` — package.json / lockfile
2. `chore: Cloudflare/Drizzle 設定ファイルを削除` — wrangler.toml / drizzle.config.ts / open-next.config.ts / scripts / .env*
3. `feat: 認証・プロフィール機能を削除` — src/ 配下の削除
4. `docs: DB 関連ドキュメントを削除` — DATABASE_SETUP.md / README / AGENTS.md / CLAUDE.md
