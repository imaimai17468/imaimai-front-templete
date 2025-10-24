# Development Workflow Rules

このファイルは、Claude Codeを使用した開発ワークフローの標準手順を定義します。
新機能の追加やバグ修正を行う際は、以下のフローに従ってください。

## 基本方針

- **できるだけ全てのフェーズを実行する**（タイプ別の推奨フローは下記参照）
- **各フェーズで TodoWrite ツールを活用**して進捗を管理する
- **不明点があれば AskUserQuestion で確認**してから進める
- **エラーが発生したら必ず修正**してから次のフェーズに進む
- **コミット前にすべてのチェックがパス**していることを確認
- **段階的にコミット**し、大きすぎる変更を避ける
- **Next.js MCP、Chrome DevTools MCPを積極的に活用**して動作確認を徹底する

---

## クイックリファレンス

変更のタイプに応じて、適切なフローを選択してください：

| 変更タイプ | 推奨フロー | 所要時間目安 | 説明 |
|-----------|-----------|-------------|------|
| **新機能追加** | Phase 1-11 全て | 60-120分 | 完全なワークフロー |
| **中規模バグ修正** | 1,4,5,6,8,9A,10,11 | 30-60分 | 調査→実装→テスト→確認 |
| **UI/デザイン調整** | 1,3,4,5,8,9A,10,11 | 20-40分 | UIデザインレビュー含む |
| **小規模リファクタ** | 1,4,5,8,10,11 | 15-30分 | 既存パターン踏襲 |
| **タイポ修正** | 5,8,10,11 | 5分 | 設定ファイルや小さな修正 |
| **ドキュメント更新** | 5,10,11 | 5-10分 | ドキュメントのみの変更 |

**Phase 9について:**
- **Phase 9A（簡易確認）**: 必須 - Next.js MCPでエラーチェック
- **Phase 9B（詳細検証）**: 任意 - Chrome DevToolsでの詳細確認

---

## フェーズ概要

### 必須フェーズ vs 任意フェーズ

#### 必須フェーズ（ほぼすべてのケースで実行）
1. **Phase 1: Investigation & Research** - Context7/Serenaで調査
4. **Phase 4: Planning** - TodoWriteで計画立案
5. **Phase 5: Implementation** - コード実装
8. **Phase 8: Quality Checks** - bun run でチェック実行
9. **Phase 9A: Runtime Verification** - Next.js MCPで動作確認
10. **Phase 10: Git Commit** - コミット作成
11. **Phase 11: Push** - リモートへプッシュ

#### 状況に応じて実行（推奨）
2. **Phase 2: Architecture Design** - 新機能や大規模変更時
3. **Phase 3: UI/UX Design** - UI変更がある場合
6. **Phase 6: Testing & Stories** - ロジック変更がある場合
7. **Phase 7: Code Review** - リファクタリングが必要な場合
9. **Phase 9B: Browser Verification** - 詳細な動作確認が必要な場合

---

## Workflow Steps

### Phase 1: Investigation & Research (調査フェーズ) 【必須】

**使用ツール**: Context7 MCP, Serena MCP

#### 1. 既存コードベースの調査
- Serena MCPを使用して関連するコンポーネント、関数、モジュールを検索
- `mcp__serena__find_symbol` で既存の実装を確認
- `mcp__serena__find_referencing_symbols` で依存関係を把握
- `mcp__serena__get_symbols_overview` でファイル構造を理解

#### 2. ライブラリドキュメントの確認
- Context7 MCPを使用して最新のライブラリドキュメントを取得
- Next.js, React, その他使用するライブラリの最新情報を確認
- `mcp__context7__resolve-library-id` → `mcp__context7__get-library-docs` の順で実行

#### 3. 調査結果の整理
- 既存パターンやコーディング規約を把握
- 再利用可能なコンポーネントやユーティリティを特定
- 必要に応じて `mcp__serena__write_memory` で調査結果を保存

**完了チェックリスト:**
- [ ] 関連する既存コードを特定
- [ ] 必要なライブラリのドキュメントを確認
- [ ] 既存パターンを把握

---

### Phase 2: Architecture Design (アーキテクチャ設計) 【推奨：新機能/大規模変更時】

**使用エージェント**: component-refactoring-specialist

**このフェーズをスキップできるケース:**
- 既存パターンに完全に倣う場合
- 1ファイル以内の小さな修正
- ドキュメントやスタイルのみの変更

#### 1. 技術的方針の決定
- ファイル配置、ディレクトリ構造の決定
- 状態管理の方法（useState, useContext, 外部ライブラリなど）
- データフローとコンポーネント間の関係性の設計
- APIエンドポイントやデータ取得戦略の決定

#### 2. コンポーネント設計
- `component-refactoring-specialist` エージェントを使用
- コンポーネント分割の方針（責任の分離、単一責任原則）
- Props インターフェースの設計
- 再利用性と保守性を考慮した設計
- 既存コンポーネントとの整合性確認

#### 3. パフォーマンス考慮事項
- Next.js 16の機能活用（Cache Components, Server Componentsなど）
- レンダリング戦略（SSR, SSG, ISRなど）
- 画像最適化、コード分割など

**完了チェックリスト:**
- [ ] ファイル配置とディレクトリ構造を決定
- [ ] コンポーネント分割方針を決定
- [ ] 状態管理とデータフローを設計
- [ ] パフォーマンス戦略を検討

---

### Phase 3: UI/UX Design (デザイン設計) 【推奨：UI変更時】

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

### Phase 4: Planning (計画立案) 【必須】

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

### Phase 5: Implementation (実装) 【必須】

**使用ツール**: Edit, Write, Read, mcp__serena__* tools

#### 1. コード実装
- アーキテクチャ設計に基づいて実装
- TypeScriptの型定義を厳密に
- 日本語コメントで意図を明確に

#### 2. 進捗管理
- TodoWriteツールでタスクを `in_progress` → `completed` に更新
- 一度に1つのタスクに集中

#### 3. コーディング規約の遵守
- ESLint、Prettierの設定に従う
- プロジェクト固有のパターンを踏襲
- **バレルインポート禁止**（`@/` aliasを使用した個別インポート）

**完了チェックリスト:**
- [ ] TypeScript型定義が厳密
- [ ] バレルインポート未使用
- [ ] 既存パターンに準拠
- [ ] 日本語コメントで意図を説明
- [ ] TodoWriteで進捗更新済み

---

### Phase 6: Testing & Stories (テスト・ストーリー作成) 【推奨：ロジック変更時】

**使用エージェント**: test-guideline-enforcer, storybook-story-creator

**このフェーズをスキップできるケース:**
- UI/表示のみの変更でロジック変更なし
- 既存テストが十分にカバーしている場合
- ドキュメントのみの変更

#### 1. Storybook ストーリー作成
- `storybook-story-creator` エージェントを使用
- **条件分岐による表示切り替えのある場合のみ**ストーリーを作成
- 単純なprops値の違いはストーリー化しない

#### 2. テストコード作成
- `test-guideline-enforcer` エージェントを使用
- Vitest / React Testing Libraryで実装
- AAAパターン（Arrange-Act-Assert）を厳守
- 日本語のテストタイトル
- すべての条件分岐をカバー

**完了チェックリスト:**
- [ ] 必要なストーリーを作成
- [ ] テストコードがAAAパターンに準拠
- [ ] すべての条件分岐をカバー
- [ ] テストタイトルが日本語で明確

---

### Phase 7: Code Review (コードレビュー) 【推奨：リファクタリング時】

**使用エージェント**: component-refactoring-specialist

**このフェーズを実行すべきケース:**
- コードの品質に不安がある場合
- リファクタリングが必要な場合
- 複雑なロジックを実装した場合

#### 1. 実装レビュー
- `component-refactoring-specialist` エージェントを使用
- コードの品質、可読性、保守性を確認
- ベストプラクティスへの準拠を確認
- パフォーマンス上の問題がないか確認
- コンポーネントの責任分離が適切か確認

#### 2. リファクタリング
- 必要に応じてコードを改善
- 重複コードの削除
- 命名の改善
- コンポーネントの分割・統合の提案

**完了チェックリスト:**
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
bun run type-check

# Lint
bun run lint

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
- [ ] Lintエラーがゼロ
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

詳細なMCPコマンドについては **[CLAUDE_MCP_REFERENCE.md](./CLAUDE_MCP_REFERENCE.md)** を参照してください。

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

詳細なMCPコマンドについては **[CLAUDE_MCP_REFERENCE.md](./CLAUDE_MCP_REFERENCE.md)** を参照してください。

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

---

## トラブルシューティング

### Phase 8でビルドエラーが発生
1. エラーメッセージを詳細に確認
2. `mcp__ide__getDiagnostics` で型エラーの詳細を取得
3. 必要に応じて Phase 5 に戻って修正
4. Phase 8 を再実行

### Phase 9Aでランタイムエラーが発生
1. Next.js MCPで詳細確認（`get-errors`, `get-logs`）
2. エラーの原因を特定
3. Phase 5 に戻って修正
4. Phase 8, 9A を再実行

### Phase 9Bでブラウザエラーが発生
1. Chrome DevToolsでコンソールエラー確認（`list_console_messages`）
2. ネットワークエラー確認（`list_network_requests`）
3. 必要に応じて Phase 5 に戻って修正
4. Phase 8, 9A, 9B を再実行

### テストが失敗する
1. テストエラーメッセージを確認
2. 期待値と実際の値を比較
3. Phase 5 または Phase 6 に戻って修正
4. Phase 8 を再実行

---

## 補足資料

- **[CLAUDE_MCP_REFERENCE.md](./CLAUDE_MCP_REFERENCE.md)**: Next.js MCP、Chrome DevTools MCP、Browser Eval MCPの詳細なコマンドリファレンス
