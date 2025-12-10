# Development Workflow Rules

このファイルは、Claude Codeを使用した開発ワークフローの標準手順を定義します。
新機能の追加やバグ修正を行う際は、以下のフローに従ってください。

---

## 使用エージェント

以下のカスタムコマンドが利用可能です：

- **`coding-specialist`** (`.claude/agents/coding-specialist.md`) - Reactコンポーネントのコーディング専門家。ロジック抽出、プレゼンターパターン適用、ディレクトリ構造の再編成を担当
- **`test-guideline-enforcer`** (`.claude/agents/test-guideline-enforcer.md`) - Vitest / React Testing Libraryを使用したテストコードの品質、構造、命名規約を強制
- **`storybook-story-creator`** (`.claude/agents/storybook-story-creator.md`) - プロジェクトルールに準拠したStorybookストーリーの作成とメンテナンス
- **`ui-design-advisor`** (`.claude/agents/ui-design-advisor.md`) - UI/UXデザイン専門家。レイアウトのレビューと改善提案を担当

---

## Workflow Steps

### Phase 1: Investigation & Research (調査フェーズ) 【必須】

**使用ツール**: Context7 MCP, Kiri MCP

#### 1. 既存コードベースの調査（Kiri MCPを使用）

Kiri MCPはSerenaより高度な検索機能を提供します。セマンティック検索、フレーズ認識、依存関係分析などを活用してください。

**1-1. コンテキスト自動取得（推奨）**
```
mcp__kiri__context_bundle
goal: 'user authentication, login flow, JWT validation'
limit: 10
compact: true
```
- タスクに関連するコードスニペットを自動でランク付けして取得
- `goal`には具体的なキーワードを使用（抽象的な動詞は避ける）
- `compact: true`でトークン消費を95%削減

**1-2. 具体的なキーワード検索**
```
mcp__kiri__files_search
query: 'validateToken'
lang: 'typescript'
path_prefix: 'src/auth/'
```
- 関数名、クラス名、エラーメッセージなど具体的な識別子で検索
- 広範な調査には`context_bundle`を使用

**1-3. 依存関係の調査**
```
mcp__kiri__deps_closure
path: 'src/auth/login.ts'
direction: 'inbound'
max_depth: 3
```
- 影響範囲分析（inbound）や依存チェーン（outbound）を取得
- リファクタリング時の影響調査に最適

**1-4. コードの詳細取得**
```
mcp__kiri__snippets_get
path: 'src/auth/login.ts'
```
- ファイルパスがわかっている場合に使用
- シンボル境界を認識して適切なセクションを抽出

#### 2. ライブラリドキュメントの確認
- Context7 MCPを使用して最新のライブラリドキュメントを取得
- Next.js, React, その他使用するライブラリの最新情報を確認
- `mcp__context7__resolve-library-id` → `mcp__context7__get-library-docs` の順で実行

#### 3. 調査結果の整理
- 既存パターンやコーディング規約を把握
- 再利用可能なコンポーネントやユーティリティを特定
- Kiriで取得したコンテキストを基に実装方針を決定

**完了チェックリスト:**
- [ ] Kiri MCPで関連コードを特定
- [ ] 必要なライブラリのドキュメントを確認
- [ ] 既存パターンと依存関係を把握

---

### Phase 2: UI/UX Design (デザイン設計) 【推奨：UI変更時】

**使用エージェント**: ui-design-advisor

**このフェーズをスキップできるケース:**
- UIに変更がない場合
- ロジックのみの変更
- バックエンド処理のみの変更

#### 1. デザインレビュー
- ダークテーマを中心としたカラー戦略
- タイポグラフィとスペーシングの確認
- 視覚的階層とレイアウト設計

#### 2. アクセシビリティ確認
- セマンティックHTML
- ARIA属性の適切な使用
- キーボード操作対応

#### 3. レスポンシブデザイン
- モバイル、タブレット、デスクトップでの表示確認
- ブレークポイントの設定

**完了チェックリスト:**
- [ ] カラーとタイポグラフィを確認
- [ ] アクセシビリティ要件を確認
- [ ] レスポンシブ対応を計画

---

### Phase 3: Planning (計画立案) 【必須】

**使用ツール**: TodoWrite tool

#### 1. 実装計画の作成
- タスクを細分化し、実装順序を決定
- TodoWriteツールで作業項目をトラッキング
- 各タスクの依存関係を明確化

#### 2. 計画のレビュー
- 不明確な要件や仕様の洗い出し
- 必要に応じて `AskUserQuestion` で確認

**注意**: ExitPlanModeツールはplan modeでのみ使用されます。通常の実装フローではTodoWriteのみを使用してください。

**完了チェックリスト:**
- [ ] TodoWriteで全タスクを登録
- [ ] タスクの実行順序を決定
- [ ] 不明点をすべて解消

---

### Phase 4: Plan Review (計画レビュー) 【必須】

**使用ツール**: Codex MCP + coding-specialist ガイドライン

#### 1. 計画のレビュー依頼

Codex MCPを使用して、coding-specialistのガイドラインに基づいて計画をレビューします。

```
mcp__codex__codex
prompt: ".claude/agents/coding-specialist.mdのガイドラインに基づいて、以下の実装計画をレビューしてください：

【実装計画】
[TodoWriteで作成した計画内容]

以下の観点でレビューしてください：
1. coding-specialistガイドラインへの準拠
2. アーキテクチャ的な問題点
3. 改善提案
4. 見落としている考慮事項"
sessionId: "plan-review-[task-name]"
model: "gpt-5-codex"
reasoningEffort: "high"
```

#### 2. レビュー結果の反映

- 指摘事項を確認し、必要に応じて計画を修正
- TodoWriteを更新して修正内容を反映
- 不明点があれば `AskUserQuestion` で確認

**完了チェックリスト:**
- [ ] Codexによる計画レビューを実施
- [ ] 指摘事項を確認・修正
- [ ] TodoWriteを更新

---

### Phase 5: Implementation (実装) 【必須】

**使用ツール**: Serena MCP (シンボルベース編集), Edit, Write, Read

#### 1. コード実装（Serena MCPを使用）

Serena MCPはシンボルベースのコード編集に特化しています。Phase 1でKiriで調査した内容を基に、Serenaで正確に実装してください。

**1-1. シンボルの置換**
```
mcp__serena__replace_symbol_body
name_path: 'UserAuth/validateToken'
relative_path: 'src/auth/user.ts'
body: '新しい関数実装'
```
- 既存の関数、メソッド、クラスの本体を置換
- シンボルのname_pathで正確に特定

**1-2. 新しいコードの挿入**
```
mcp__serena__insert_after_symbol
name_path: 'UserAuth'
relative_path: 'src/auth/user.ts'
body: '新しいメソッドの実装'
```
- 既存シンボルの後に新しいコードを挿入
- クラスへのメソッド追加、ファイル末尾への関数追加などに使用

**1-3. シンボルのリネーム**
```
mcp__serena__rename_symbol
name_path: 'validateToken'
relative_path: 'src/auth/user.ts'
new_name: 'verifyJwtToken'
```
- シンボルをプロジェクト全体でリネーム
- すべての参照が自動的に更新される

**1-4. 参照の確認**
```
mcp__serena__find_referencing_symbols
name_path: 'validateToken'
relative_path: 'src/auth/user.ts'
```
- 変更前に影響範囲を確認
- どのファイル・シンボルが参照しているか特定

#### 2. コーディング規約の遵守
- TypeScriptの型定義を厳密に
- 日本語コメントで意図を明確に
- Biomeの設定に従う
- プロジェクト固有のパターンを踏襲
- **バレルインポート禁止**（`@/` aliasを使用した個別インポート）

#### 3. 進捗管理
- TodoWriteツールでタスクを `in_progress` → `completed` に更新
- 一度に1つのタスクに集中

**完了チェックリスト:**
- [ ] Serena MCPでシンボルベース編集を実施
- [ ] TypeScript型定義が厳密
- [ ] バレルインポート未使用
- [ ] 既存パターンに準拠
- [ ] 日本語コメントで意図を説明
- [ ] TodoWriteで進捗更新済み

---

### Phase 6: Testing & Stories (テスト・ストーリー作成) 【推奨：ロジック変更時】

**使用エージェント**: test-guideline-enforcer, storybook-story-creator
**使用ツール**: Serena MCP（実装）

**このフェーズをスキップできるケース:**
- UI/表示のみの変更でロジック変更なし
- 既存テストが十分にカバーしている場合
- ドキュメントのみの変更

#### 1. Storybook ストーリー作成
- `storybook-story-creator` エージェントでストーリー設計
- **条件分岐による表示切り替えのある場合のみ**ストーリーを作成
- 単純なprops値の違いはストーリー化しない
- **実装はSerena MCPで行う**（`insert_after_symbol` など）

#### 2. テストコード作成
- `test-guideline-enforcer` エージェントでテスト設計
- Vitest / React Testing Libraryで実装
- **実装はSerena MCPで行う**（テストファイル作成・編集）
- AAAパターン（Arrange-Act-Assert）を厳守
- 日本語のテストタイトル
- すべての条件分岐をカバー

**完了チェックリスト:**
- [ ] 必要なストーリーを作成
- [ ] テストコードがAAAパターンに準拠
- [ ] すべての条件分岐をカバー
- [ ] テストタイトルが日本語で明確

---

### Phase 7: Code Review (コードレビュー) 【必須】

**使用ツール**: Codex MCP + coding-specialist ガイドライン

#### 1. 実装レビュー依頼

Codex MCPを使用して、coding-specialistのガイドラインに基づいて実装コードをレビューします。

```
mcp__codex__codex
prompt: ".claude/agents/coding-specialist.mdのガイドラインに基づいて、以下の実装コードをレビューしてください：

【実装コード】
[変更したファイルのパスと内容]

以下の観点でレビューしてください：
1. coding-specialistガイドラインへの準拠
2. コードの品質、可読性、保守性
3. ベストプラクティスへの準拠
4. パフォーマンス上の問題
5. コンポーネントの責任分離
6. リファクタリングの必要性"
sessionId: "code-review-[task-name]"
model: "gpt-5-codex"
reasoningEffort: "high"
```

#### 2. レビュー結果の反映

- 指摘事項を確認
- **必要な修正はSerena MCPで実施**
- 重複コードの削除、命名改善、コンポーネント分割などを実施
- 不明点があれば `AskUserQuestion` で確認

**完了チェックリスト:**
- [ ] Codexによるコードレビューを実施
- [ ] 指摘事項を確認・修正（Serena MCP使用）
- [ ] コード品質が基準を満たす
- [ ] ベストプラクティスに準拠
- [ ] パフォーマンス問題なし
- [ ] 責任分離が適切

---

### Phase 8: Quality Checks (品質チェック) 【必須】

**使用ツール**: Bash tool

#### 1. 静的解析とテスト実行

```bash
# 型チェック
bun run typecheck

# Lint (Biome)
bun run check

# テスト実行
bun run test

# ビルド確認
bun run build
```

#### 2. エラーの修正
- エラーが発生した場合は修正して再実行
- すべてのチェックがパスするまで繰り返す

**完了チェックリスト:**
- [ ] 型チェックが通る
- [ ] Biome checkがパス
- [ ] すべてのテストが通る
- [ ] ビルドが成功

**トラブルシューティング:**
- エラーが続く場合は Phase 5 に戻って修正
- 必要に応じて `mcp__ide__getDiagnostics` で詳細確認

---

### Phase 9: Browser Verification (ブラウザ動作確認)

このフェーズは2つのサブフェーズに分かれています：

#### Phase 9A: Runtime Verification 【必須】

**使用ツール**: mcp__next-devtools__nextjs_runtime

**目的**: Next.js開発サーバーのランタイムエラーを確認

1. **開発サーバー起動**
   ```bash
   bun run dev
   ```

2. **Next.js Runtime確認**
   - サーバー検出: `action: 'discover_servers'`
   - ツール一覧: `action: 'list_tools'`
   - エラー確認: `toolName: 'get-errors'`
   - ルート確認: `toolName: 'get-routes'`
   - ログ確認: `toolName: 'get-logs'`

3. **基本チェック**
   - [ ] ビルド・ランタイムエラーがゼロ
   - [ ] 全ルートが正しく動作
   - [ ] コンソールエラー・警告がゼロ

詳細なMCPコマンドについては **[MCP_REFERENCE.md](./MCP_REFERENCE.md)** を参照してください。

#### Phase 9B: Browser Verification 【任意：詳細確認が必要な場合】

**使用ツール**: mcp__chrome-devtools__*

**このフェーズを実行すべきケース:**
- 複雑なUIインタラクション
- パフォーマンス測定が必要
- ネットワークリクエストの確認
- レスポンシブデザインの詳細確認

**主な確認項目:**
- ページ構造とアクセシビリティ（`take_snapshot`, `take_screenshot`）
- インタラクション（`click`, `fill`, `hover`）
- ネットワーク・コンソール（`list_console_messages`, `list_network_requests`）
- パフォーマンス（`performance_start_trace`, Core Web Vitals）
- レスポンシブ（`resize_page`, `emulate_cpu`, `emulate_network`）

詳細なMCPコマンドについては **[MCP_REFERENCE.md](./MCP_REFERENCE.md)** を参照してください。

**完了チェックリスト（Phase 9B実行時）:**
- [ ] ネットワークリクエストが正常（4xx/5xxエラーなし）
- [ ] Core Web Vitals（LCP, FID, CLS）が良好
- [ ] レスポンシブデザインが正常（375px〜1920px）
- [ ] アクセシビリティツリーが適切

---

### Phase 10: Git Commit 【必須】

**使用ツール**: Bash tool

#### 1. 変更内容の確認
```bash
git status
git diff
```

#### 2. コミット作成
- 適切なコミットメッセージを作成（英語、簡潔に）
- コミットメッセージフォーマット：`<type>: <description>`
- type例：feat, fix, refactor, docs, test, style, chore

```bash
git add .
git commit -m "feat: add new feature description"
```

**完了チェックリスト:**
- [ ] git statusで意図しないファイルが含まれていない
- [ ] コミットメッセージが適切
- [ ] 変更内容が論理的にまとまっている

---

### Phase 11: Push 【必須】

**使用ツール**: Bash tool

#### 1. リモートへプッシュ
```bash
git push origin <branch-name>
```

#### 2. 必要に応じてPR作成
```bash
gh pr create --title "PR title" --body "PR description"
```

**完了チェックリスト:**
- [ ] プッシュが成功
- [ ] 必要に応じてPR作成
