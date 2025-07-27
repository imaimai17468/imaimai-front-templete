# Implementation Guide for Migration Filename Improvement

## 実装指示

backend/src/script/auto_migrate/auto_migrate.py の `_generate_message_from_changes` メソッドを拡張し、新しいファイル命名システムを実装してください。

## Decision Tree (既にファイルに記載済み)
- 単一変更 → {action}_{name}_{target}
- 同一テーブル複数同種 → {action}_{count}{target}_{table}_table
- 同一テーブル複数異種 → change_{count}items_{table}_table
- 複数テーブル同種 → {action}_{target}_{count}tables
- 複数テーブル異種 → change_mixed_actions

## 実装要件

### 1. 新しいメソッドの追加
`_generate_filename_from_changes(self, changes: List[MigrationChange]) -> str` メソッドを追加

### 2. 変更分析ロジック
- テーブル別グループ化: `by_table = {}`
- アクション別グループ化: `by_action = {}`
- 同一テーブル判定: `is_single_table = len(by_table) == 1`
- 同一アクション判定: `is_single_action = len(by_action) == 1`

### 3. 命名パターン実装
```python
if len(changes) == 1:
    # 単一変更: create_users_table
    return f"{action}_{name}_{target}"
elif is_single_table and is_single_action:
    # 同一テーブル複数同種: add_3columns_users_table
    return f"{action}_{count}{target}_{table}_table"
elif is_single_table:
    # 同一テーブル複数異種: change_2items_users_table
    return f"change_{count}items_{table}_table"
elif is_single_action:
    # 複数テーブル同種: create_2tables
    return f"{action}_{target}_{count}tables"
else:
    # 複数テーブル異種: change_mixed_actions
    return "change_mixed_actions"
```

### 4. アクション変換
- drop_table → delete_table
- drop_column → delete_column
- drop_index → delete_index

### 5. 重複語回避
- create_table_2tables → create_2tables
- add_column_3columns → add_3columns

### 6. 優先順位
create > add > modify > delete の順で主要アクションを決定

### 7. _update_migration_file メソッド修正
`new_filename = f"{number}_{self._generate_filename_from_changes(changes)}.py"`

## 実装箇所
- 既存の `_generate_message_from_changes` メソッドは保持
- 新しい `_generate_filename_from_changes` メソッドを追加
- `_update_migration_file` メソッドでファイル名生成部分を変更