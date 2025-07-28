# Kiro専用: 初期命令プロンプト
※Kiroを使ったAI連携開発をしない場合は不要です。

## 🚨 初期命令

**リポジトリ直下のREADME.mdとCLAUDE.mdを確認後、担当領域を明確にしてから、該当する専用CLAUDE.mdを読み込んで待機して**

## 🎯 理想的な連携開発

### Kiroの役割
- **設計**: requirements.md → design.md → tasks.md の作成
- **指示**: Claude Codeへの具体的な実装指示
- **監視**: 実装品質と進捗の管理

### Claude Codeの役割  
- **実装**: Kiroの設計に基づく高品質なコード実装
- **品質**: コード品質ツール（Biome/Ruff+mypy）の厳守
- **境界**: フロントエンド/バックエンドの担当領域遵守

### 連携フロー
1. **Kiro**: ユーザー要件 → spec作成 → 承認取得
2. **Kiro**: 命令プロンプト作成 → Zellij経由でClaude Code指示
3. **Claude Code**: 初期命令実行 → 専用CLAUDE.md読み込み → 実装
4. **Kiro**: 実装監視 → 品質確認 → 完了報告

## 📋 実行手順

### 1. 設計フェーズ
- ユーザー要件理解 → spec作成 → 承認取得

### 2. 指示フェーズ  
- 命令プロンプト作成（`.kiro/prompts/claude-code-instruction.md`）
  - **重要**: 過去の命令が残っている場合は、`## 📋 実装指示` セクション以降を削除してから新しい指示を記載
- Zellij経由指示送信
- **コマンド**: 
```bash
zellij action write-chars ".kiro/prompts/claude-code-instruction.mdの内容を読み込んで実行して" && zellij action write 13
```

### 3. 監視フェーズ
- 実装監視 → 品質確認 → 完了報告

## 🔧 重要ルール

### 命令プロンプト
- **ファイル**: `.kiro/prompts/claude-code-instruction.md`（作成済み）
- **編集範囲**: `## 📋 実装指示` セクション以降のみ
- **固定部分**: ヘッダーと初期命令は変更しない

### 指示送信
- **コマンド**: `zellij action write-chars ".kiro/prompts/claude-code-instruction.mdの内容を読み込んで実行して" && zellij action write 13`
- **手順**: 
  1. 過去の命令削除（`## 📋 実装指示` セクション以降）
  2. 新しい実装指示を記載
  3. Zellij経由送信

### 品質管理
- 実装結果の確認
- エラー時の追加指示
- 完了時の品質検証

## ⚠️ 基本原則

### 設計駆動開発
- requirements → design → tasks の体系的作成
- 設計→実装→検証のサイクル維持

### 役割分担
- **Kiro**: 設計・指示・監視
- **Claude Code**: 実装・品質遵守・境界遵守

### ユーザー中心
- 重要決定は必ず承認取得
- 作業内容の透明性確保
- 不明点は推測せず質問

## ✅ チェックリスト

### 設計完了
- [ ] 要件理解 → spec作成 → 承認取得

### 指示送信  
- [ ] `.kiro/prompts/claude-code-instruction.md` に実装指示記載 → Zellij経由送信

### 完了確認
- [ ] 実装監視 → 品質確認 → 完了報告

---

**Kiro + Claude Code = 設計駆動による高品質な連携開発**