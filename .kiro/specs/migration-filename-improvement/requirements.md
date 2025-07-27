# Requirements Document

## Introduction

現在のマイグレーションファイル命名システムは変更内容を単純につなげるため冗長な名前になっている（例: `0003_create_sample2_table_table_create_sample3_table_ta.py`）。これを改善し、`{number}_{action}{target}{context}`の構造に沿ったシンプルで意味のある命名システムを実装する。

## Requirements

### Requirement 1: 基本命名構造の実装

**User Story:** As a developer, I want migration files to follow a consistent naming pattern, so that I can easily understand what changes each migration contains.

#### Acceptance Criteria

1. WHEN 単一のテーブルに単一の変更がある THEN ファイル名は `{number}_{action}_{name}_{target}` 形式になること
   - 例: `0001_create_users_table`, `0002_add_email_column`, `0003_delete_sessions_table`

2. WHEN 同一テーブルに複数の同じ種類の変更がある THEN ファイル名は `{number}_{action}_{count}{target}_{table}_table` 形式になること
   - 例: `0004_add_3columns_users_table`, `0005_delete_2columns_posts_table`

3. WHEN 複数テーブルに跨る変更がある THEN ファイル名は `{number}_change_{count}{target}` または `{number}_{action}_{target}_{count}tables` 形式になること
   - 例: `0006_change_3columns`, `0007_create_2tables`

### Requirement 2: 境界ケースの処理

**User Story:** As a developer, I want the naming system to handle complex scenarios consistently, so that all migration types are properly represented.

#### Acceptance Criteria

1. WHEN 同一テーブルに異なる種類の変更がある THEN ファイル名は `{number}_change_{count}items_{table}_table` 形式になること
   - 例: `0008_change_2items_users_table` (usersテーブルにカラム追加とインデックス作成)

2. WHEN 複数テーブルに同じ種類の変更がある THEN ファイル名は `{number}_{action}_{target}_{count}tables` 形式になること
   - 例: `0009_add_columns_2tables`, `0010_create_3tables`

3. WHEN 複数テーブルに複数種類の変更がある THEN ファイル名は `{number}_change_mixed_actions` 形式になること
   - 例: `0011_change_mixed_actions`

### Requirement 3: 重複語の回避

**User Story:** As a developer, I want migration filenames to avoid redundant words, so that the names are concise and readable.

#### Acceptance Criteria

1. WHEN actionとtargetに同じ語が含まれる THEN 重複を回避した命名になること
   - ❌ `create_table_2tables` → ✅ `create_2tables`
   - ❌ `add_column_3columns` → ✅ `add_3columns`
   - ❌ `delete_table_2tables` → ✅ `delete_2tables`

2. WHEN 単一対象の場合 THEN 具体的な名前を含めること
   - 例: `create_users_table`, `add_email_column`

### Requirement 4: 変更タイプの分類と優先順位

**User Story:** As a developer, I want the system to categorize different types of database changes, so that the most important change is reflected in the filename.

#### Acceptance Criteria

1. WHEN 複数の変更タイプが混在する THEN 以下の優先順位で主要な変更を決定すること
   - create > add > modify > delete の順

2. WHEN 同じ優先度の変更が複数ある THEN 数の多い変更タイプを採用すること

3. WHEN 判定が困難な場合 THEN `change_mixed_actions` を使用すること

### Requirement 5: 対応する変更タイプ

**User Story:** As a developer, I want the system to handle all common database operations, so that any schema change can be properly named.

#### Acceptance Criteria

1. WHEN テーブル操作がある THEN 以下の命名パターンを使用すること
   - create_table, delete_table, rename_table

2. WHEN カラム操作がある THEN 以下の命名パターンを使用すること
   - add_column, delete_column, modify_column, rename_column

3. WHEN インデックス操作がある THEN 以下の命名パターンを使用すること
   - create_index, delete_index

4. WHEN 制約操作がある THEN 以下の命名パターンを使用すること
   - create_constraint, delete_constraint, create_foreign_key, delete_foreign_key

### Requirement 6: 既存システムとの互換性

**User Story:** As a developer, I want the new naming system to work with existing migration infrastructure, so that I don't need to change other parts of the system.

#### Acceptance Criteria

1. WHEN 新しい命名システムを適用する THEN 既存のAlembicマイグレーション機能は正常に動作すること

2. WHEN ファイル名を生成する THEN 既存の番号付けシステム（0001, 0002...）を維持すること

3. WHEN マイグレーションメッセージを生成する THEN 既存のメッセージ生成ロジックと整合性を保つこと

### Requirement 7: ログとデバッグ情報

**User Story:** As a developer, I want detailed logging of the naming decision process, so that I can understand why a particular filename was chosen.

#### Acceptance Criteria

1. WHEN ファイル名を生成する THEN 決定プロセスをログに記録すること

2. WHEN 複数の変更を分析する THEN 各変更の分類結果をログに出力すること

3. WHEN 命名ルールを適用する THEN 適用されたルールをデバッグ情報として記録すること