# Next.js → TanStack Start 移行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` を使い、このプランを task 単位で subagent にディスパッチして実装すること。各 task の subagent dispatch 前に `aegis_compile_context` を再実行する（`.claude/rules/agents.md` のルール）。

**Goal:** Next.js 16 (App Router + OpenNext + Cloudflare Workers) で構築されている本テンプレートを、TanStack Start (Vite + Nitro + TanStack Router) に big bang 方式で全置換し、Cloudflare Workers + D1/R2 + better-auth + Drizzle の現行機能を 100% 維持する。

**Architecture:**
- ルーティングは TanStack Router の file-based routing (`src/routes/`) に置換。サーバ I/O は TanStack Start の **Server Functions** (`createServerFn`) と **API Routes** (`createServerFileRoute`) を使い、Server Actions の "use server" / `revalidatePath` を Server Function + `queryClient.invalidateQueries` に置換する。
- Cloudflare Workers デプロイは TanStack Start (Nitro) の **`cloudflare-module`** preset に切り替え。OpenNext / `next.config.mjs` / `open-next.config.ts` / `next-env.d.ts` を全て削除。`wrangler.toml` の `main` を `.output/server/index.mjs` 系へ更新。
- D1/R2 アクセスは `getCloudflareContext()` (OpenNext 提供) → Nitro の `getEvent(event).context.cloudflare.env` ベースのヘルパに統一。`worker-configuration.d.ts` (= `wrangler types` 出力) はそのまま温存し、`CloudflareEnv` 型を引き続き活用する (ADR-0005)。
- 認証ミドルウェア (`src/middleware.ts`) は TanStack Router の **`beforeLoad` route guard** で `/profile/*` セッションチェックに置換。

**Tech Stack:**
- `@tanstack/react-start` / `@tanstack/react-router` (+ `@tanstack/router-plugin/vite`)
- Vite 6 + `@vitejs/plugin-react` (既存) / Nitro + `cloudflare-module` preset
- `wrangler` 4 + `wrangler types` (既存)
- 既存維持: `better-auth`, `drizzle-orm`, `react-hook-form`, `zod`, Tailwind v4, oxlint/oxfmt, vitest, tsgo

**Aegis context (compile_id base):** `1cff5d35-7c9c-4392-b0bd-460dba7a756d` (snapshot `1851ab1f...`).

参照 ADR: ADR-0001 (rules-include) / ADR-0003 (subagent-driven) / ADR-0005 (wrangler types) / ADR-0006 (orchestration-layering)。本プランの実行で **新ADR `docs/adr/0007-tanstack-start-migration.md` を作成** すること（big bang 移行および Cloudflare preset 切替の意思決定記録）。

---

## Context

「ADR-0001 を含む既存テンプレ規約 (colocation / Container-Presenter / pure-function / no-loops / Tailwind tokens-only / 厳密バージョン pinning) を保ったまま、Next.js から TanStack Start にフレームワーク移行したい」というユーザ要件。テンプレートとして Cloudflare Workers + D1 + R2 + better-auth + Drizzle のフルスタック構成は維持。OpenNext は廃止し、TanStack Start ネイティブな Cloudflare Workers デプロイへ切り替える。

ユーザ承認済みの判断:
- Cloudflare 継続 + TanStack Start 公式 CF preset 採用
- 全機能維持 (better-auth / D1 / R2 avatars / login / profile / middleware)
- big bang 全置換 (incremental 共存はしない)

---

## File Structure (移行後)

```
src/
├── router.tsx                       # TanStack Router 定義 (createRouter)
├── routeTree.gen.ts                 # plugin が自動生成 (gitignore 対象)
├── client.tsx                       # ブラウザ entry (hydrateRoot)
├── ssr.tsx                          # サーバ entry (createStartHandler)
├── routes/
│   ├── __root.tsx                   # 旧 src/app/layout.tsx 相当 (ThemeProvider / Sonner / Header / <Outlet />)
│   ├── index.tsx                    # 旧 src/app/page.tsx
│   ├── login.tsx                    # 旧 src/app/login/page.tsx
│   ├── profile.tsx                  # 旧 src/app/profile/page.tsx (beforeLoad で auth guard)
│   ├── auth.auth-code-error.tsx     # 旧 src/app/auth/auth-code-error/page.tsx
│   ├── -components/                 # ルート colocation。`-` プレフィックスでルート扱いを除外
│   │   └── Clock/ ...               # 旧 src/app/components/Clock を移設
│   └── api/
│       ├── auth.$.ts                # 旧 src/app/api/auth/[...all]/route.ts (createServerFileRoute)
│       └── avatars.ts               # 旧 src/app/api/avatars/route.ts
├── server/
│   ├── cloudflare.ts                # getCloudflareEnv() ヘルパ (Nitro event → CloudflareEnv)
│   └── auth-guard.ts                # better-auth セッション検査ヘルパ (旧 middleware ロジック)
├── components/                      # 既存維持 (shared/ui/features) — next/link → @tanstack/react-router Link 置換のみ
├── actions/                         # 削除 (Server Functions に再配置 = src/server/fn-*.ts に移動)
├── server/fn/
│   ├── auth.ts                      # 旧 src/actions/auth.ts (createServerFn)
│   └── profile.ts                   # 旧 src/actions/profile.ts (createServerFn)
├── lib/                             # 既存維持。lib/drizzle/db.ts と lib/storage/r2.ts のみ getCloudflareContext を抽象化
├── entities/, gateways/, hooks/     # 既存維持 (revalidatePath は queryClient.invalidateQueries に置換)
└── styles.css                       # 旧 src/app/globals.css (Vite import に変更)

(削除)
src/app/                             # 全削除
src/actions/                         # 全削除 (server/fn/ へ)
src/middleware.ts                    # 削除 (beforeLoad に統合)
next.config.mjs / next-env.d.ts / open-next.config.ts
.next/, .open-next/
```

`vite.config.ts` をルートに新規作成。`tsconfig.json` の `paths` (`@/*`) と `include` は維持。

---

## Tasks

各 task は **subagent (`general-purpose` / model: `sonnet`)** に dispatch する。dispatch 前に `aegis_compile_context` を `target_files` 付きで再呼び出しし、guidelines をブリーフィングに引用すること（`.claude/rules/agents.md`）。

### Task 0: ADR-0007 起票 + 移行ブランチ

**Files:**
- Create: `docs/adr/0007-tanstack-start-migration.md`

- [ ] **Step 1: ADR を ADR-0001〜0006 と同じ構造で作成**
  - Status: accepted / Date: 2026-04-30
  - Context: Next.js 16 App Router + OpenNext で運用していたが、Vite ネイティブ + TanStack Router の DX/型推論を採用するため移行。
  - Decision: TanStack Start + `cloudflare-module` preset。OpenNext 廃止。
  - Alternatives: Remix (RR v7) / Astro / Next 据え置き — それぞれ却下理由を記述。
  - Consequences: `wrangler types` ベースの `CloudflareEnv` (ADR-0005) は維持。Server Actions → Server Functions の書き換えコストが発生。

- [ ] **Step 2: `aegis_import_doc` で ADR を Aegis に登録**
  - `edge_hints`: `[{path: "src/routes/**"}, {path: "vite.config.ts"}, {path: "src/server/**"}]`
  - `tags`: `["architecture", "cloudflare", "wrangler", "react"]` + 新タグ `tanstack-start` (admin surface 経由で Aegis に承認させる)
  - tagless にしない (`.claude/rules` 規約)。

- [ ] **Step 3: コミット**
  - `docs: add ADR-0007 for TanStack Start migration`

### Task 1: 依存差し替え (package.json)

**Files:**
- Modify: `package.json`
- Modify: `bun.lockb` (生成物)

- [ ] **Step 1: 依存追加 (exact pin)**
  ```bash
  bun add -E @tanstack/react-start @tanstack/react-router @tanstack/router-plugin
  bun add -E -d vite @cloudflare/workers-types
  ```

- [ ] **Step 2: 依存削除**
  ```bash
  bun remove next @opennextjs/cloudflare
  ```

- [ ] **Step 3: scripts を書き換え**
  ```json
  "dev": "vite dev",
  "build": "vite build",
  "start": "node .output/server/index.mjs",
  "preview": "wrangler dev",
  "deploy": "vite build && wrangler deploy"
  ```
  `cf-typegen` / `db:*` / `lint` / `format` / `typecheck` / `test` / `knip` は維持。

- [ ] **Step 4: `bun pm ls` で `^` / `~` / major-only が残っていないこと検証 (ADR rule-dependencies)**

- [ ] **Step 5: コミット**

### Task 2: Vite + TanStack Start ブートストラップ

**Files:**
- Create: `vite.config.ts`
- Create: `src/router.tsx`
- Create: `src/client.tsx`
- Create: `src/ssr.tsx`
- Create: `src/routes/__root.tsx` (最小: ThemeProvider + Outlet + ScrollRestoration)
- Create: `src/routes/index.tsx` (placeholder)
- Modify: `tsconfig.json` (`moduleResolution: "Bundler"`, `jsx: "react-jsx"`, include に `routeTree.gen.ts` 追加)
- Modify: `.gitignore` (`routeTree.gen.ts`, `.output/`, `.tanstack/` を追加、`.next/` は削除)

- [ ] **Step 1: vite.config.ts を作成**
  ```ts
  import { defineConfig } from "vite";
  import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
  import react from "@vitejs/plugin-react";
  import tsconfigPaths from "vite-tsconfig-paths";
  import { tanstackStart } from "@tanstack/react-start/plugin/vite";

  export default defineConfig({
    plugins: [
      tsconfigPaths(),
      TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
      react(),
      tanstackStart({ target: "cloudflare-module" }),
    ],
  });
  ```
- [ ] **Step 2: `src/router.tsx` で `createRouter({ routeTree, defaultPreload: "intent" })` を export**
- [ ] **Step 3: `src/client.tsx` (`StartClient`) と `src/ssr.tsx` (`createStartHandler`) を雛形通り作成**
- [ ] **Step 4: `__root.tsx` で `<head>` (lang="ja", `<HeadContent />`, `<Scripts />`) と `globals.css` (→ `styles.css` に rename) を import**
- [ ] **Step 5: `bun run dev` で TanStack Start トップが表示されることを確認**
- [ ] **Step 6: コミット**

### Task 3: ページのポーティング (UI components 流用)

**Files:**
- Create: `src/routes/index.tsx`, `src/routes/login.tsx`, `src/routes/profile.tsx`, `src/routes/auth.auth-code-error.tsx`, `src/routes/-components/Clock/*` (Clock 一式を移動)
- Modify: `src/components/shared/header/Header.tsx`, `auth-navigation/AuthNavigation.tsx`, `user-menu/UserMenu.tsx`, `src/routes/index.tsx`, `src/routes/auth.auth-code-error.tsx` で `next/link` を `@tanstack/react-router` の `Link` に置換 (7 箇所)
- Delete: `src/app/` 配下を全削除 (Task 6 で一括)

- [ ] **Step 1: 各 page.tsx の中身を `createFileRoute("/...").
  createRoute({ component: ... })` でラップして `src/routes/<route>.tsx` として再配置**
- [ ] **Step 2: `next/link` → `import { Link } from "@tanstack/react-router"`。`href` → `to` に書換 (7 ファイル)**
- [ ] **Step 3: `next/navigation` の `redirect("/login")` → TanStack の `redirect({ to: "/login", throw: true })` (`profile.tsx` の `beforeLoad`、後続 Task 4 と統合)**
- [ ] **Step 4: `next-themes` は同 API なので `__root.tsx` 配下にプロバイダ移設のみ**
- [ ] **Step 5: 既存 Vitest テスト (Clock) がパスすることを確認: `bun run test`**
- [ ] **Step 6: コミット (`refactor: port pages to TanStack routes`)**

### Task 4: 認証ガードと Cloudflare env helper

**Files:**
- Create: `src/server/cloudflare.ts`
- Create: `src/server/auth-guard.ts`
- Modify: `src/lib/drizzle/db.ts` (`getCloudflareContext` → `getCloudflareEnv()`、`react.cache` を Nitro request scope に置換)
- Modify: `src/lib/storage/r2.ts` (同上)
- Modify: `src/lib/auth/auth.ts` / `src/lib/auth/session.ts` (`next/headers` の `headers()` → `getRequestHeaders()` (Nitro `getRequestHeaders(event)` ラッパ))
- Modify: `src/routes/profile.tsx` (`beforeLoad` で `auth-guard` を呼び、未認証なら `throw redirect({ to: "/login" })`)
- Delete: `src/middleware.ts` (旧 cookie ガードは beforeLoad に統合)

- [ ] **Step 1: `src/server/cloudflare.ts` を実装**
  ```ts
  import { getEvent } from "@tanstack/react-start/server";
  export const getCloudflareEnv = (): CloudflareEnv =>
    (getEvent().context as { cloudflare: { env: CloudflareEnv } }).cloudflare.env;
  ```
- [ ] **Step 2: `src/server/auth-guard.ts` を実装** — better-auth `auth.api.getSession({ headers })` を使い `null` なら `redirect({ to: "/login" })` を throw
- [ ] **Step 3: `src/lib/drizzle/db.ts` の `getCloudflareContext().env.DB` を `getCloudflareEnv().DB` に置換。`react.cache` は削除し、Nitro の per-request シングルトンに変更**
- [ ] **Step 4: `src/lib/storage/r2.ts` 同様に `getCloudflareEnv().AVATARS_BUCKET`**
- [ ] **Step 5: `src/middleware.ts` 削除し、`profile.tsx` の `createFileRoute` に `beforeLoad: ({ context }) => requireSession()` を追加**
- [ ] **Step 6: コミット (`refactor: replace next middleware with TanStack beforeLoad guard`)**

### Task 5: API ルート (better-auth catch-all + R2 avatars) の移植

**Files:**
- Create: `src/routes/api/auth.$.ts` (catch-all server file route — better-auth handler を mount)
- Create: `src/routes/api/avatars.ts` (GET handler — `?key=` で R2 から取得して `Response` で返す)
- Delete: `src/app/api/auth/[...all]/route.ts`, `src/app/api/avatars/route.ts`

- [ ] **Step 1: `auth.$.ts` を作成**
  ```ts
  import { createServerFileRoute } from "@tanstack/react-start/server";
  import { getAuth } from "@/lib/auth/auth";
  export const ServerRoute = createServerFileRoute("/api/auth/$").methods({
    GET: ({ request }) => getAuth().handler(request),
    POST: ({ request }) => getAuth().handler(request),
  });
  ```
- [ ] **Step 2: `avatars.ts` を作成 — R2 `get(key)` の結果を `Response` (`Cache-Control: public, max-age=...`) で返す**
- [ ] **Step 3: 旧 route.ts を削除**
- [ ] **Step 4: `bun run dev` で `/api/auth/session` と `/api/avatars?key=...` が動作することを Cloudflare devtools / curl で検証**
- [ ] **Step 5: コミット**

### Task 6: Server Actions → Server Functions 移植 + revalidate 置換

**Files:**
- Create: `src/server/fn/auth.ts`, `src/server/fn/profile.ts` (`createServerFn`)
- Modify: `src/gateways/user/index.ts` (`revalidatePath("/profile")` を削除し、呼び出し側で `queryClient.invalidateQueries({ queryKey: ["me"] })` を実行する責務に変更)
- Modify: `src/components/features/profile-page/profile-form/ProfileForm.tsx` (`useMutation` + `invalidateQueries` パターンに変更)
- Delete: `src/actions/auth.ts`, `src/actions/profile.ts`

- [ ] **Step 1: `src/server/fn/profile.ts` を作成**
  ```ts
  import { createServerFn } from "@tanstack/react-start";
  export const updateProfileFn = createServerFn({ method: "POST" })
    .validator((data: ProfileInput) => profileSchema.parse(data))
    .handler(async ({ data }) => { /* gateways/user.updateUser */ });
  ```
- [ ] **Step 2: `auth.ts` を同様に移植 (signOut)**
- [ ] **Step 3: `gateways/user/index.ts` から `next/cache` import を完全に削除。invalidate 責務を呼び出し側に委譲**
- [ ] **Step 4: フォーム側で `useMutation` + `onSuccess: () => queryClient.invalidateQueries(...)` に書換**
- [ ] **Step 5: 旧 `src/app/`, `src/actions/`, `next.config.mjs`, `next-env.d.ts`, `open-next.config.ts`, `.next/`, `.open-next/` を削除**
- [ ] **Step 6: `bun run typecheck && bun run lint && bun run test` を全通過 (no-loops / props-driven / colocation 規約は subagent が rule-architecture を参照しつつ維持)**
- [ ] **Step 7: コミット**

### Task 7: Wrangler / デプロイ整備

**Files:**
- Modify: `wrangler.toml` (`main = ".output/server/index.mjs"`, `[assets] directory = ".output/public"` に変更。`compatibility_date` は据え置き)
- Modify: `README.md` (起動・デプロイ手順を Next → TanStack Start に更新)

- [ ] **Step 1: `wrangler.toml` の `main` / `[assets]` を Nitro `cloudflare-module` の出力に合わせる**
- [ ] **Step 2: `bun run cf-typegen` を実行し `worker-configuration.d.ts` 再生成 (ADR-0005)**
- [ ] **Step 3: `bun run preview` (`wrangler dev`) で D1/R2 バインディング込みのローカル動作確認**
- [ ] **Step 4: README の `bun dev` / `bun run preview` / `bun run deploy` 手順を更新**
- [ ] **Step 5: コミット**

### Task 8: 仕上げ (knip / lint / docs)

- [ ] **Step 1: `bun run knip` で未使用 export / dep を確認、残骸を削除**
- [ ] **Step 2: `bun run check && bun run typecheck && bun run test` 全通過**
- [ ] **Step 3: `superpowers:requesting-code-review` で fresh reviewer pass (`.claude/rules/agents.md` 末尾規約)**
- [ ] **Step 4: 最終コミット & PR (target: `main`)**

---

## Verification (E2E)

1. `bun install` → エラーなし
2. `bun run typecheck` → 0 errors (tsgo)
3. `bun run lint && bun run format` → 0 violations (oxlint / oxfmt)
4. `bun run test` → Clock の既存テスト含め全 pass
5. `bun run dev` → http://localhost:3000 にトップが表示される
6. `/login` → Google OAuth でセッション獲得 (better-auth 経由)
7. `/profile` → 未ログイン時に `/login` リダイレクト (beforeLoad guard)
8. `/profile` プロフィール編集 → ProfileForm が Server Function 経由で更新成功、UI が即時反映される (queryClient invalidate)
9. `/api/avatars?key=...` → R2 から画像が配信される
10. `bun run preview` (wrangler dev) → D1/R2/Cloudflare env 込みでローカル動作
11. `bun run knip` → 未使用警告なし

---

## Out of scope

- 認可ロジックの拡張 / プロバイダ追加
- D1 スキーマ変更
- UI / Tailwind デザイン刷新 — colocation / Container-Presenter / Tailwind tokens-only ルール (rule-style / rule-architecture) は厳守するが、見た目は変更しない
- テスト追加: 既存テストを通すのみ。新規 Presenter / pure function を作成した場合のみ TDD (`superpowers:test-driven-development`) を適用する
