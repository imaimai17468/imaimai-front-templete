# いまいまいのフロントエンドテンプレート

## プロジェクト概要

### 技術スタック
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (厳格モード)
- **Styling**: Tailwind CSS, shadcn/ui
- **Testing**: Vitest, React Testing Library
- **UI Documentation**: Storybook
- **Backend**: Supabase (PostgreSQL, Auth)
- **Build**: Bun
- **Lint/Format**: Biome

## コーディング原則

**実装・リファクタリング時は必ず `coding-guidelines` Skill を参照してください**。

Skillには以下の詳細ガイドライン（600行以上）が含まれます：
- **テスト容易性**（内部状態 vs Props制御、条件分岐の抽出）
- **Props制御**（すべての表示状態をpropsで制御可能に）
- **コンポーネント責務分離**（データフェッチング vs UI表示）
- **ディレクトリ構造**（kebab-case、親子階層の明確化）
- **AIが失敗しやすいパターン**（実装前チェックリスト）
- **具体的なコード例**（❌NG / ✅OK パターン比較）

## 利用可能なツール

### SubAgents（タスク実行）

- **`plan-reviewer`**: 調査（Kiri MCP）、UI/UXレビュー（ui-design-guidelines）、実装計画作成（TodoWrite）、統合レビュー（Codex MCP）
- **`implement-review`**: 実装（Serena MCP）、コードレビュー（Codex MCP）
- **`test-review`**: テスト・ストーリー作成（Serena MCP）、テストレビュー（Codex MCP）

### Skills（知識参照）

- **`coding-guidelines`**: React/TypeScript規約、アーキテクチャパターン、AI失敗パターン
- **`test-guidelines`**: Vitest/RTL規約、AAAパターン、カバレッジ基準
- **`storybook-guidelines`**: Storybookストーリー作成規約
- **`ui-design-guidelines`**: 4pxグリッド、深度戦略、アニメーション規約、Anti-Patterns、汎用AIアエステティック回避
- **`human-interface-guidelines`**: 認知心理学・HCI原則に基づくUX設計、メンタルモデル、インタラクションパターン

### MCPs（Model Context Protocol）

- **Kiri**: セマンティックコード検索、依存関係分析
- **Context7**: ライブラリドキュメント取得（Next.js等）
- **Serena**: シンボルベースコード編集（シンボル検索、置換、挿入、リネーム）
- **Codex**: AIコードレビュー
- **Chrome DevTools**: ブラウザ自動化（スナップショット、クリック、評価）
- **Next DevTools**: Next.js Runtime診断（エラー取得、ルート情報）

## コマンドリファレンス

### 開発
```bash
bun run dev              # 開発サーバー起動
bun run build            # プロダクションビルド
bun run start            # ビルド後のサーバー起動
```

### 品質チェック
```bash
bun run typecheck        # TypeScript型チェック
bun run check            # Biome lint/format チェック
bun run check:fix        # Biome lint/format 自動修正
bun run test             # Vitest テスト実行
```

### Storybook
```bash
bun run storybook        # Storybook起動 (port 6006)
bun run build-storybook  # Storybookビルド
```

### データベース
```bash
bun run db:generate      # Drizzle migration生成
bun run db:push          # Drizzle migration適用
```
