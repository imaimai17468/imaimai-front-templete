export const SETUP = `git clone https://github.com/imaimai17468/imaimai-front-templete.git
cd imaimai-front-templete
mise install                 # Node / Bun / actionlint / shellcheck を mise.toml の版で用意
bun run setup                # 依存・git hooks・生成ファイル・.env.local をまとめて用意
bun run dev`;

export const TREE = `src/
├── routes/                 # ディレクトリ名が URL セグメント
│   ├── __root.tsx          # Root layout (ThemeProvider, Header, Toaster)
│   ├── index/
│   │   ├── route.tsx       # Home page
│   │   └── -components/    # このルートだけが描くもの（- 始まりは URL にならない）
│   ├── login/              # route.tsx と -components/
│   ├── _authed/
│   │   ├── route.tsx       # 配下をまとめて守る pathless layout
│   │   └── profile/        # route.tsx と -components/
│   ├── auth.auth-code-error/  # OAuth failure landing page（route.tsx と -components/）
│   └── api/                # API routes (auth catch-all, avatars)
├── shared/                 # 2 つ以上のルートが使うもの
│   ├── components/         # 自前で書いたコンポーネント
│   ├── ui/                 # shadcn/ui primitives
│   ├── gateway/            # 認可境界と D1 / R2 アクセス
│   │   └── user/
│   │       ├── read.ts     # プロフィール読み取り
│   │       ├── read.fn.ts  # createServerFn（ブラウザに配られる側）
│   │       ├── update.ts   # 名前とアバターの更新
│   │       ├── update.fn.ts  # createServerFn（ブラウザに配られる側）
│   │       ├── index.ts    # 永続化エラーと共通ヘルパー
│   │       └── avatar/     # アバターの配信とアップロード
│   └── entities/           # Domain types and schemas
├── lib/
│   ├── auth/               # Better Auth 設定
│   ├── cloudflare/         # CloudflareEnv helper (cloudflare:workers)
│   ├── drizzle/            # Drizzle ORM スキーマ
│   ├── storage/            # R2 ストレージ
│   └── utils.ts
├── test/                   # Test helpers (router harness, cloudflare:workers stub)
├── router.tsx              # TanStack Router definition
├── ssr.tsx                 # Server entry (Cloudflare Worker handler)
├── test-setup.ts           # Vitest setup
└── styles.css              # Tailwind v4 tokens`;

interface Spec {
  readonly heading: string;
  readonly rows: readonly { readonly term: string; readonly detail: string }[];
}

export const SPECS: readonly Spec[] = [
  {
    heading: "同梱されているもの",
    rows: [
      {
        term: "認証",
        detail:
          "Better Auth と Google OAuth。/login でサインインし、_authed の beforeLoad が配下のページから未認証を弾く",
      },
      { term: "データ", detail: "Cloudflare D1 と Drizzle ORM" },
      {
        term: "データ取得",
        detail:
          "TanStack Query。loader が queryClient.query でキャッシュを満たし、コンポーネントは useSuspenseQuery で読む",
      },
      {
        term: "ファイル",
        detail: "Cloudflare R2。プロフィール画像のアップロードが動く",
      },
      {
        term: "UI",
        detail:
          "shadcn/ui（new-york）と Tailwind CSS v4。bunx shadcn@latest add [component-name] で足す",
      },
      {
        term: "言語",
        detail: "TypeScript 7。型検査は Go 実装の tsc が走る",
      },
      { term: "テスト", detail: "Vitest と Testing Library" },
      {
        term: "実行環境",
        detail:
          "Cloudflare Workers。@cloudflare/vite-plugin により bun run dev でも D1 と R2 のバインディングが有効",
      },
      { term: "パッケージ", detail: "Bun。バージョンは mise.toml が固定する" },
    ],
  },
  {
    heading: "自動で走る検査",
    rows: [
      {
        term: "層の契約",
        detail:
          "ルートとコンポーネント → gateway → entities。逆向きの import と、ルートを跨ぐ -components/ の参照は tools/oxlint-plugins が落とす",
      },
      {
        term: "コミット前",
        detail:
          "staged なファイルに oxlint --type-aware と oxfmt --check（lefthook）",
      },
      {
        term: "push 前",
        detail: "bun run check と bun run typecheck（lefthook）",
      },
      {
        term: "テスト",
        detail:
          "純関数のモジュールは分岐 100% を vitest.config.mts が per-file で強制する",
      },
      {
        term: "未使用",
        detail: "fallow が未使用の依存とエクスポートとファイルを検出する",
      },
      {
        term: "重複",
        detail:
          "fallow が pre-push と CI でコードの複製を検出する。関数単位の near-miss も含み、リネームした写しに届く",
      },
      {
        term: "React",
        detail: "oxlint-plugin-react-doctor が React 向けの追加ルールを掛ける",
      },
    ],
  },
  {
    heading: "エージェントで開発する",
    rows: [
      {
        term: "AGENTS.md",
        detail:
          "規約の本体。毎セッション読み込まれる（CLAUDE.md はこれを読み込むだけ）",
      },
      {
        term: ".claude/rules/",
        detail:
          "規約の分冊。path scope を持つものは対象ファイルを編集するときだけ読み込まれる",
      },
      {
        term: ".claude/skills/",
        detail:
          "名前のついた作業の手順。チケット粒度の作業は ticket-work が持つ",
      },
      {
        term: ".claude/hooks/",
        detail:
          "規約を機械的に強制する側。SessionStart で依存の欠落を報告し、Bash 実行前にガードを掛け、Stop で品質ゲートを回す",
      },
    ],
  },
];

interface ExternalLink {
  readonly name: string;
  readonly href: string;
}

export const LINKS: readonly ExternalLink[] = [
  { name: "TanStack Start", href: "https://tanstack.com/start/" },
  { name: "TanStack Router", href: "https://tanstack.com/router/" },
  { name: "Tailwind CSS", href: "https://tailwindcss.com/docs" },
  { name: "shadcn/ui", href: "https://ui.shadcn.com/" },
  { name: "Better Auth", href: "https://www.better-auth.com/" },
  { name: "Cloudflare D1", href: "https://developers.cloudflare.com/d1/" },
  { name: "Cloudflare R2", href: "https://developers.cloudflare.com/r2/" },
  {
    name: "@cloudflare/vite-plugin",
    href: "https://developers.cloudflare.com/workers/vite-plugin/",
  },
  {
    name: "TypeScript 7",
    href: "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/",
  },
  { name: "oxlint", href: "https://oxc.rs/docs/guide/usage/linter" },
  { name: "oxfmt", href: "https://oxc.rs/docs/guide/usage/formatter" },
  { name: "react-doctor", href: "https://github.com/millionco/react-doctor" },
  { name: "lefthook", href: "https://github.com/evilmartians/lefthook" },
  { name: "fallow", href: "https://docs.fallow.tools/" },
  { name: "Vitest", href: "https://vitest.dev/" },
  { name: "mise", href: "https://mise.jdx.dev/" },
];
