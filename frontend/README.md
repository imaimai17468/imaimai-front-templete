# My App

Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui を使用したモダンなWebアプリケーションテンプレートです。

## 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Code Quality**: Biome (linting & formatting)
- **Testing**: Vitest + Testing Library
- **Storybook**: Component development & documentation
- **Package Manager**: Bun
- **Git Hooks**: Lefthook

## 開発環境のセットアップ

### 前提条件

- Node.js 18.0.0 以上
- Bun (推奨) または npm/yarn/pnpm

### インストール

```bash
bun install
```

### 開発サーバーの起動

```bash
bun run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## 利用可能なコマンド

### 開発

```bash
bun run dev          # 開発サーバーを起動
bun run build        # プロダクション用ビルド
bun run start        # プロダクションサーバーを起動
bun run typecheck    # TypeScript型チェック
```

### コード品質

```bash
bun run check        # Biome linter/formatter チェック
bun run check:fix    # Biome 自動修正（unsafe修正含む）
bun run format       # Biome フォーマットチェック
bun run format:fix   # Biome 自動フォーマット
```

### テスト

```bash
bun run test         # Vitestでテスト実行
```

### Storybook

```bash
bun run storybook        # Storybook開発サーバーを起動 (http://localhost:6006)
bun run build-storybook  # Storybookをビルド
```

## プロジェクト構成

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # グローバルスタイル
│   ├── layout.tsx         # ルートレイアウト
│   └── page.tsx           # ホームページ
├── components/
│   ├── ui/                # shadcn/ui コンポーネント
│   ├── shared/            # 共有コンポーネント
│   └── features/          # 機能別コンポーネント
└── lib/
    └── utils.ts           # ユーティリティ関数
```

## コーディング規約

このプロジェクトは厳密なコーディング規約に従っています：

- **コンポーネント命名**: ディレクトリ名（kebab-case）とTSXファイル名（PascalCase）の対応
- **インポート**: `@/` エイリアスを使用した絶対パス
- **コード品質**: Biomeによる自動linting/formatting
- **Git Hooks**: コミット前の自動品質チェック

詳細は `CLAUDE.md` を参照してください。

## Git Hooks

Lefthookにより以下のフックが自動実行されます：

- **Pre-commit**: `bun run check:fix` による自動修正
- **Pre-push**: `bun run check` と `bun run typecheck` による品質チェック

## shadcn/ui

shadcn/uiコンポーネントは `src/components/ui/` に配置されています。新しいコンポーネントを追加する場合：

```bash
bunx shadcn@latest add [component-name]
```

## 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Biome](https://biomejs.dev/)
- [Vitest](https://vitest.dev/)
- [Storybook](https://storybook.js.org/)
