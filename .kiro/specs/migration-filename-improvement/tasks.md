# Implementation Plan

## Task List

- [ ] 1. 既存コードの分析と理解
  - 現在の `_generate_message_from_changes` メソッドの動作を理解
  - 既存の `MigrationChange` データクラスの構造を確認
  - 現在の `_slugify` メソッドの動作を分析
  - _Requirements: Requirement 6_

- [ ] 2. 変更分析ロジックの拡張
  - `_analyze_migration_content` メソッドに変更分類機能を追加
  - テーブル別・アクション別のグループ化機能を実装
  - 同一テーブル判定ロジックの追加
  - _Requirements: Requirement 2, Requirement 4_

- [ ] 3. 命名ルールエンジンの実装
  - 新しい `_generate_filename_from_changes` メソッドを作成
  - Decision Tree に基づく命名パターン判定ロジックを実装
  - 単一変更パターンの処理を実装
  - _Requirements: Requirement 1.1_

- [ ] 4. 複数変更パターンの実装
  - 同一テーブル複数同種変更の命名ロジックを実装
  - 同一テーブル複数異種変更の命名ロジックを実装
  - 複数テーブル同種変更の命名ロジックを実装
  - 複数テーブル異種変更の命名ロジックを実装
  - _Requirements: Requirement 1.2, Requirement 1.3, Requirement 2_

- [ ] 5. 重複語回避機能の実装
  - action と target の重複検出ロジックを追加
  - 重複回避のための文字列処理を実装
  - 既存の `_slugify` メソッドを拡張
  - _Requirements: Requirement 3_

- [ ] 6. 優先順位システムの実装
  - アクション優先順位の定義（create > add > modify > delete）
  - 複数変更時の主要変更決定ロジックを実装
  - 同数の場合の処理ロジックを追加
  - _Requirements: Requirement 4_

- [ ] 7. 変更タイプマッピングの更新
  - `drop_*` を `delete_*` に変更するマッピングを追加
  - 新しい変更タイプの対応を実装
  - 既存の正規表現パターンを更新
  - _Requirements: Requirement 5_

- [ ] 8. ファイル名生成の統合
  - `_update_migration_file` メソッドを新しい命名システムに対応
  - 既存の番号付けシステムとの統合
  - ファイル名長制限の処理を実装
  - _Requirements: Requirement 6_

- [ ] 9. ログとデバッグ機能の追加
  - 命名決定プロセスのログ出力を追加
  - 変更分類結果のデバッグ情報を実装
  - 適用されたルールの記録機能を追加
  - _Requirements: Requirement 7_

- [ ] 10. 既存システムとの互換性確保
  - 既存の `_generate_message_from_changes` メソッドとの共存
  - Alembic マイグレーション機能との互換性確認
  - 既存のテストケースの動作確認
  - _Requirements: Requirement 6_

- [ ] 11. エラーハンドリングの実装
  - 空の変更リストの処理
  - 不明な変更タイプの処理
  - ファイル名生成失敗時のフォールバック
  - _Requirements: Design Error Handling_

- [ ] 12. テストケースの作成
  - 各命名パターンの単体テスト作成
  - 境界ケースのテスト実装
  - 既存機能の回帰テスト作成
  - _Requirements: Design Testing Strategy_