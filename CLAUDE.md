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

### 基本原則

1. **Server Component First**
   - 基本的にすべて Server Component で実装
   - データ取得は必ず Server で行う（async/await）
   - Server Component を Suspense で挟んでローディング状態を管理
   - インタラクティブ操作やフォームなど、仕方ない場合のみ "use client" を使用

2. **ディレクトリ構造**
   - `components/`: 汎用的な再利用可能コンポーネント
   - `features/`: 機能ごとのコンポーネント
   - コンポーネントで使用する関数は、**関数名でファイル化して同階層に配置**
   - **ディレクトリを切るのはコンポーネントを切る時のみ**（utils/ や helpers/ は作らない）

3. **entity/gateway パターン**
   - `entities/`: データ型定義とバリデーション（Zodスキーマ）
   - `gateways/`: データ取得関数（外部API呼び出し）
   - Server Component で gateway 関数を呼び出してデータ取得

4. **Props制御とテスト容易性**
   - すべての表示状態を props で制御可能にする
   - 内部状態に依存する条件分岐を避ける
   - コンポーネントは純粋な表示ロジックのみ

## 利用可能なツール

### Skills（知識参照）

#### コーディング系
- **`coding-guidelines`**: React/TypeScript規約、アーキテクチャパターン、AI失敗パターン
- **`test-guidelines`**: Vitest/RTL規約、AAAパターン、カバレッジ基準
- **`storybook-guidelines`**: Storybookストーリー作成規約

#### デザイン系
- **`design-guidelines`**: UI/UX設計原則の統合ガイドライン
  - ui-design.md: 視覚デザイン（タイポグラフィ、色、モーション、Anti-Patterns、汎用AIアエステティック回避）
  - ux-design.md: UX設計（認知心理学、HCI原則、メンタルモデル、インタラクションパターン）

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

### コード重複検出
```bash
similarity-ts src/       # コードの類似度を検出
similarity-ts src/ --print   # コード内容も表示
similarity-ts src/ --threshold 0.8  # 閾値を80%に設定（デフォルト: 87%）
similarity-ts src/ --classes        # クラスの重複も検出
similarity-ts src/ --types          # 型定義の重複も検出（デフォルト有効）
```

**使用例と検出結果**:

similarity-ts は TypeScript/JavaScript のコード重複を AST ベースで検出します。

```bash
# 実行例
similarity-ts src/ --exclude node_modules --exclude .next

# 検出結果の例
# === Function Similarity ===
# Similarity: 100.00%
#   src/app/api/overpass/police-boxes/route.ts:4-36 GET
#   src/app/api/overpass/street-lights/route.ts:4-36 GET
#
# === Type Similarity ===
# Similarity: 100.00%
#   src/repositories/overpass/useStreetLights.ts:4 BoundsKey
#   src/repositories/overpass/usePoliceBoxes.ts:4 BoundsKey
```

**リファクタリング指針**:
- 100% 重複: 即座にリファクタリング推奨（共通関数/型に抽出）
- 90%以上: リファクタリング検討（パターンの統一）
- 80-90%: 将来的なリファクタリング候補

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
