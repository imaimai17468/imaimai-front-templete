# CLAUDE.md

## 🚨 AIエージェント向け必読事項

### 読み込み順序
1. **このファイル** - 基本原則、技術構成、ワークフロー、開発コマンド
2. **詳細ガイドライン** - 必要に応じて以下を参照

### 📚 詳細ガイドライン（必要に応じて参照）
@./docs/naming-conventions.md
@./docs/component-guidelines.md
@./docs/testing-guidelines.md
@./docs/storybook-guidelines.md

---

## 重要: 基本原則

### 1. 日本語コミュニケーション
Claude Code は日本語でコミュニケーションを行う必要があります。すべてのコミットメッセージ、コメント、エラーメッセージ、ユーザーとのやり取りは日本語で行ってください。

### 2. 事前承認要件
**重要**: ファイルの作成、編集、削除を行う前に、必ず以下を報告し、明示的なユーザー承認を得てください：
- 対象ファイルのリスト
- 実行する変更の詳細説明
- 影響範囲の説明

### 3. 決定権限の原則
- **最終決定権限は常にユーザーにある**
- AIは勝手に代替アプローチや回避策を選択してはならない
- 不明な点がある場合は常に質問し、推測で進めてはならない

### 4. CLAUDE.md コンプライアンス確認
作業を開始する前に、このドキュメントの関連ルールとの適合性を確認し、それをユーザーに報告してください。

### 5. 標準ワークフロー
すべてのタスクに対して以下の手順に従ってください：

```yaml
ステップ 1: タスク理解
  - ユーザー要件を明確に理解する
  - 不明な点があれば質問する
  - 期待される成果物を確認する

ステップ 2: 計画立案
  - 詳細な実行計画を作成する
  - 影響を受けるファイルとシステムを特定する
  - リスクと考慮事項を評価する

ステップ 3: 事前報告
  - 計画をユーザーに報告する
  - 明示的な承認を得る
  - 承認なしに実行してはならない

ステップ 4: 実行
  - 計画に従って実行する
  - 予期しない状況を即座に報告する
  - 独断で決定を下してはならない

ステップ 5: 完了報告
  - 実行結果を詳細に報告する
  - 変更の確認を求める
  - 次のアクションを確認する
```

### 6. 必須チェックリスト
操作前に以下のチェックリストを実行してください：

#### ファイル操作前
- [ ] 関連するCLAUDE.mdルールを確認済み
- [ ] 対象ファイルの現在の状態を理解済み
- [ ] 変更による影響範囲を特定済み
- [ ] 明示的なユーザー承認を取得済み
- [ ] バックアップと復旧方法を考慮済み

#### コード生成/編集前
- [ ] プロジェクトの命名規則を確認済み
- [ ] 既存のコードスタイルを理解済み
- [ ] 依存関係と技術スタックを確認済み
- [ ] テストと品質要件を確認済み

#### Git操作前
- [ ] 変更が意図通りであることを確認済み
- [ ] コミットメッセージガイドラインを確認済み
- [ ] ブランチング戦略を理解済み
- [ ] プッシュ前の最終検証を実行済み

## 開発コマンド

### 基本コマンド
- `bun run dev` - 開発サーバーを開始（Next.js）
- `bun run build` - 本番アプリケーションをビルド
- `bun run start` - 本番サーバーを開始
- `bun run typecheck` - TypeScriptで型チェック

### コード品質コマンド
- `bun run check` - Biome リンターとフォーマッターのチェックを実行
- `bun run check:fix` - Biome で自動修正を実行（安全でない修正を含む）
- `bun run format` - Biome でフォーマットをチェック
- `bun run format:fix` - Biome でコードを自動フォーマット

### テストコマンド
- `bun run test` - Vitest でテストを一度実行して終了（`bun test`の代わりに使用）

### コード解析コマンド
- `similarity-ts .` - コードベース全体で重複する関数と類似コードパターンを検出

### Git フック
- **Pre-commit**: 自動的に `bun run check:fix` を実行し、修正されたファイルをステージ
- **Pre-push**: プッシュ前に `bun run check` と `bun run typecheck` を実行

## アーキテクチャ

### 技術スタック
- **フレームワーク**: Next.js 15 with App Router
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS v4
- **UIコンポーネント**: shadcn/ui with Radix UI primitives
- **コード品質**: Biome for linting and formatting
- **Git hooks**: Lefthook

### プロジェクト構造
```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # グローバルスタイル
│   ├── layout.tsx         # ルートレイアウト
│   └── page.tsx           # ホームページ
├── components/
│   ├── ui/                # shadcn/ui コンポーネント
│   ├── shared/            # 機能間で再利用可能なコンポーネント
│   └── features/          # 機能固有のコンポーネント
├── lib/                   # グローバルユーティリティ関数
└── hooks/                 # グローバルカスタムフック
```

### コンポーネントアーキテクチャ
- **UIコンポーネント**: `src/components/ui/` に配置 - shadcn/ui コンポーネントのみ
- **共有コンポーネント**: `src/components/shared/` に配置 - 機能間で再利用可能なコンポーネント
- **機能コンポーネント**: `src/components/features/` に配置 - 画面/ページ固有のコンポーネント
- **ユーティリティ関数**: `src/lib/utils.ts` の `cn()` 関数で clsx と tailwind-merge を使用したクラス名マージ
- **インポートエイリアス**: クリーンなインポートのために `@/` プレフィックスを設定

### Package by Feature アーキテクチャ

**核心原則**: 技術タイプではなく機能によって関連するコードをグループ化する。機能固有のロジックは、それを使用するコンポーネントの近くに配置する。

#### ディレクトリ組織ルール
1. **グローバルユーティリティ**: 真にジェネリックな関数は `src/lib/` または `src/hooks/` に配置
2. **機能固有ロジック**: 機能に固有のフック、ユーティリティ、型は機能ディレクトリ内に配置
3. **コロケーション**: 関連するコードは可能な限り使用される場所の近くに配置

#### 例

##### ✅ 正しい機能組織
```
src/components/features/chat-page/
├── ChatPage.tsx                 # メインコンポーネント
├── messageHandlers.ts           # 機能固有ロジック
├── useChatState.ts             # 機能固有フック
├── types.ts                    # 機能固有型
├── chat-header/
│   └── ChatHeader.tsx
├── chat-message/
│   ├── ChatMessage.tsx
│   └── messageUtils.ts         # メッセージ固有ユーティリティ
└── chat-input-area/
    ├── ChatInputArea.tsx
    └── inputValidation.ts      # 入力固有ロジック
```

##### ❌ 間違った組織
```
src/
├── hooks/
│   ├── useChatState.ts         # chat-page 機能にあるべき
│   └── useMessageHandling.ts   # chat-page 機能にあるべき
├── utils/
│   ├── messageHandlers.ts      # chat-page 機能にあるべき
│   └── inputValidation.ts      # chat-input-area にあるべき
└── components/features/chat-page/
    └── ChatPage.tsx            # ロジックから分離されている
```

#### グローバル vs 機能固有のガイドライン

**グローバル位置に配置**（`src/lib/`, `src/hooks/`）:
- 複数の機能で使用されるユーティリティ
- 核心的なアプリケーションロジック
- サードパーティ統合
- 共通型定義

**機能ディレクトリに配置**:
- 機能固有のビジネスロジック
- コンポーネント固有のユーティリティ
- 機能固有のフック
- 機能固有の型
- その機能内でのみ使用されるロジック

## shadcn/ui 設定

### セットアップ
- **スタイル**: New York variant
- **ベースカラー**: Neutral
- **CSS変数**: 有効
- **RSC**: React Server Components 有効
- **アイコンライブラリ**: Lucide React

### パスエイリアス
- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/utils` → `src/lib/utils`
- `@/ui` → `src/components/ui`
- `@/hooks` → `src/hooks`
