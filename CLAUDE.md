# いまいまいのフロントエンドテンプレート

## プロジェクト概要

### 技術スタック
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (厳格モード, tsgo)
- **Styling**: Tailwind CSS, shadcn/ui
- **Testing**: Vitest, React Testing Library
- **Backend**: Supabase (PostgreSQL, Auth)
- **Build**: Bun
- **Lint**: oxlint
- **Format**: oxfmt

## ディレクトリ構造

### 基本ルール

**ディレクトリを切るのはコンポーネントを切る時のみ**
- コンポーネント1つにつき1ディレクトリ
- 関数は使用するコンポーネントと同階層に配置（コロケーション）
- `src/utils/` などの汎用関数管理ディレクトリは作成しない
- コンポーネントで使用する関数は、関数名でファイル化して同階層に配置

### ディレクトリマップ

**コンポーネント階層とディレクトリ階層を一致させる**
- 親コンポーネントがディレクトリの1階層目
- 子コンポーネントはその親ディレクトリの中に配置
- 孫コンポーネントはさらにその子ディレクトリの中に配置
- 呼び出し関係がディレクトリ構造で視覚的にわかる

```
src/
├── app/                          # Next.js App Router
│   ├── (routes)/                 # ルートグループ
│   │   └── page.tsx             # ページコンポーネント
│   └── api/                      # API Routes
│
├── components/
│   ├── ui/                       # shadcn/ui コンポーネント
│   │   ├── button.tsx           # 再利用可能なUIプリミティブ
│   │   ├── form.tsx
│   │   └── input.tsx
│   │
│   ├── shared/                   # 共有コンポーネント
│   │   └── main-layout/         # レイアウトなど複数機能で使用
│   │       └── MainLayout.tsx
│   │
│   └── features/                 # 機能別コンポーネント ⭐重要⭐
│       ├── login-page/          # まず大きな機能（ページ）単位でグルーピング
│       │   ├── LoginPage.tsx    # ディレクトリ名と一致するコンポーネント（1階層目）
│       │   └── LoginForm/       # その中に各コンポーネントを配置
│       │       └── LoginForm.tsx
│       └── profile-page/        # 別の機能（ページ）
│           ├── ProfilePage.tsx  # ディレクトリ名と一致するコンポーネント（1階層目）
│           ├── formatUserName.ts  # 同階層に関数ファイルを配置
│           ├── profile-header/  # 子コンポーネント（ProfilePageから呼び出される）
│           │   ├── ProfileHeader.tsx
│           │   └── avatar/      # 孫コンポーネント（ProfileHeaderから呼び出される）
│           │       └── Avatar.tsx
│           └── profile-stats/   # 子コンポーネント（ProfilePageから呼び出される）
│               └── ProfileStats.tsx
│
├── repositories/                 # Client Component 用データ取得
│   └── generation/
│       └── use-delete-generation.ts  # React Query カスタムフック
│
├── entities/                     # データ型定義
│   └── auth/
│       └── magic-link-form.ts   # Zod スキーマ + 型定義
│
├── gateways/                     # データ取得関数
│   └── auth/
│       └── signInWithMagicLink.ts
│
└── lib/                          # ライブラリ設定
    ├── supabase/
    └── utils.ts
```

## コーディング原則

`coding-guidelines` Skill を参照してください。

## 利用可能なツール

### Skills（知識参照）

- **`coding-guidelines`**: React/TypeScript規約、アーキテクチャパターン、AI失敗パターン
- **`design-guidelines`**: UI/UX設計原則の統合ガイドライン
  - ui-design.md: 視覚デザイン（タイポグラフィ、色、モーション、Anti-Patterns、汎用AIアエステティック回避）
  - ux-design.md: UX設計（認知心理学、HCI原則、メンタルモデル、インタラクションパターン）
- **`remove-supabase`**: Supabase認証とDrizzle ORMの削除手順（データベース・認証機能が不要な場合）

### MCPs（Model Context Protocol）

- **Kiri**: セマンティックコード検索、依存関係分析
- **Context7**: ライブラリドキュメント取得（Next.js等）
- **Codex**: AIコードレビュー
- **Chrome DevTools**: ブラウザ自動化（スナップショット、クリック、評価）

## コマンドリファレンス

### 開発
```bash
bun run dev              # 開発サーバー起動
bun run build            # プロダクションビルド
bun run start            # ビルド後のサーバー起動
```

### 品質チェック
```bash
bun run typecheck        # TypeScript型チェック (tsgo)
bun run lint             # oxlint チェック
bun run lint:fix         # oxlint 自動修正
bun run format           # oxfmt フォーマットチェック
bun run format:fix       # oxfmt フォーマット適用
bun run check            # lint + format チェック
bun run check:fix        # lint + format 自動修正
bun run test             # Vitest テスト実行
```

### データベース
```bash
bun run db:generate      # Drizzle migration生成
bun run db:push          # Drizzle migration適用
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
