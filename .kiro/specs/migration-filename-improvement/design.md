# Design Document

## Overview

マイグレーションファイル命名システムを改善し、`{number}_{action}{target}{context}`の構造に沿った一貫性のある命名を実現する。現在の冗長な命名（例: `0003_create_sample2_table_table_create_sample3_table_ta.py`）を、意味のあるシンプルな命名に変更する。

### Naming Rules Summary
```
# 基本パターン
単一変更: {action}_{name}_{target}                    # create_users_table
同一テーブル複数同種: {action}_{count}{target}_{table}_table  # add_3columns_users_table  
同一テーブル複数異種: change_{count}items_{table}_table      # change_2items_users_table
複数テーブル同種: {action}_{target}_{count}tables           # create_2tables
複数テーブル異種: change_mixed_actions                     # change_mixed_actions

# 優先順位: create > add > modify > delete
# 重複語回避: create_table_2tables → create_2tables
```

## Architecture

### Core Components

#### 1. MigrationNamingEngine
マイグレーション変更を分析し、適切なファイル名を生成するメインエンジン。

#### 2. ChangeAnalyzer
マイグレーション内容を解析し、変更タイプとターゲットを特定する。

#### 3. NamingRuleEngine
定義されたルールに基づいて、変更内容から適切な命名パターンを決定する。

#### 4. FilenameGenerator
最終的なファイル名を生成し、重複チェックと番号付けを行う。

## Components and Interfaces

### MigrationNamingEngine

```python
class MigrationNamingEngine:
    def __init__(self, config: NamingConfig):
        self.change_analyzer = ChangeAnalyzer()
        self.naming_rule_engine = NamingRuleEngine(config)
        self.filename_generator = FilenameGenerator()
    
    def generate_filename(self, migration_changes: List[MigrationChange]) -> str:
        """マイグレーション変更からファイル名を生成"""
        pass
```

### ChangeAnalyzer

```python
class ChangeAnalyzer:
    def analyze_changes(self, changes: List[MigrationChange]) -> AnalyzedChanges:
        """変更を分析し、テーブル別・アクション別に分類"""
        pass
    
    def group_by_table(self, changes: List[MigrationChange]) -> Dict[str, List[MigrationChange]]:
        """テーブル別に変更をグループ化"""
        pass
    
    def group_by_action(self, changes: List[MigrationChange]) -> Dict[str, List[MigrationChange]]:
        """アクション別に変更をグループ化"""
        pass
```

### NamingRuleEngine

```python
class NamingRuleEngine:
    def __init__(self, config: NamingConfig):
        self.config = config
        self.action_priority = ["create", "add", "modify", "delete"]
    
    def determine_naming_pattern(self, analyzed_changes: AnalyzedChanges) -> NamingPattern:
        """分析された変更から命名パターンを決定"""
        pass
    
    def apply_single_change_rule(self, change: MigrationChange) -> str:
        """単一変更の命名ルール適用"""
        pass
    
    def apply_multiple_same_table_rule(self, table: str, changes: List[MigrationChange]) -> str:
        """同一テーブル複数変更の命名ルール適用"""
        pass
    
    def apply_multiple_table_rule(self, analyzed_changes: AnalyzedChanges) -> str:
        """複数テーブル変更の命名ルール適用"""
        pass
```

### Data Models

#### AnalyzedChanges

```python
@dataclass
class AnalyzedChanges:
    """分析済み変更データ"""
    by_table: Dict[str, List[MigrationChange]]
    by_action: Dict[str, List[MigrationChange]]
    total_tables: int
    total_changes: int
    dominant_action: Optional[str]
    is_single_table: bool
    is_single_action_type: bool
```

#### NamingPattern

```python
@dataclass
class NamingPattern:
    """命名パターン情報"""
    pattern_type: str  # "single", "multiple_same_table", "multiple_table", "mixed"
    action: str
    target: str
    context: str
    table_name: Optional[str] = None
    count: Optional[int] = None
```

#### NamingConfig

```python
@dataclass
class NamingConfig:
    """命名設定"""
    action_priority: List[str]
    action_mapping: Dict[str, str]  # 内部名 -> 表示名のマッピング
    target_mapping: Dict[str, str]
    max_filename_length: Optional[int] = None
    enable_redundancy_removal: bool = True
```

## Data Models

### Change Classification

変更は以下の軸で分類される：

1. **Action Type**: create, add, modify, delete
2. **Target Type**: table, column, index, constraint, foreign_key
3. **Scope**: single_table, multiple_table
4. **Complexity**: single_change, multiple_same_action, multiple_mixed_action

### Naming Decision Tree

```
変更分析
├── 単一変更？
│   ├── Yes → {action}_{name}_{target}
│   └── No → 複数変更分析
├── 複数変更分析
│   ├── 同一テーブル？
│   │   ├── Yes → 同一アクション？
│   │   │   ├── Yes → {action}_{count}{target}_{table}_table
│   │   │   └── No → change_{count}items_{table}_table
│   │   └── No → 複数テーブル分析
│   └── 複数テーブル分析
│       ├── 同一アクション？
│       │   ├── Yes → {action}_{target}_{count}tables
│       │   └── No → change_mixed_actions
```

## Error Handling

### Validation Rules

1. **Change Validation**: 空の変更リストや無効な変更タイプの検出
2. **Naming Conflict**: 既存ファイル名との重複チェック
3. **Length Validation**: ファイル名長制限（設定可能）
4. **Character Validation**: ファイルシステム互換性チェック

### Error Recovery

1. **Fallback Naming**: ルール適用失敗時のフォールバック命名
2. **Manual Override**: 手動でのファイル名指定機能
3. **Conflict Resolution**: 重複時の自動番号付加

## Testing Strategy

### Unit Tests

1. **ChangeAnalyzer Tests**: 各種変更パターンの分析テスト
2. **NamingRuleEngine Tests**: 命名ルール適用のテスト
3. **FilenameGenerator Tests**: ファイル名生成とバリデーションのテスト

### Integration Tests

1. **End-to-End Naming**: 実際のマイグレーション変更からファイル名生成まで
2. **Alembic Integration**: 既存のAlembicシステムとの統合テスト
3. **Edge Case Handling**: 境界ケースと異常系のテスト

### Test Cases

#### Basic Patterns
- 単一テーブル作成: `create_users_table`
- 単一カラム追加: `add_email_column`
- 単一テーブル削除: `delete_sessions_table`

#### Multiple Same Table
- 複数カラム追加: `add_3columns_users_table`
- 複数カラム削除: `delete_2columns_posts_table`
- 混合変更: `change_2items_users_table`

#### Multiple Tables
- 複数テーブル作成: `create_2tables`
- 複数テーブルカラム追加: `add_columns_2tables`
- 複雑な混合: `change_mixed_actions`

#### Edge Cases
- 空の変更リスト
- 不明な変更タイプ
- 極端に長いテーブル名
- 特殊文字を含む名前

## Performance Considerations

### Optimization Strategies

1. **Caching**: 分析結果のキャッシュ
2. **Lazy Evaluation**: 必要時のみ詳細分析実行
3. **Batch Processing**: 複数変更の効率的な処理

### Memory Management

1. **Object Reuse**: 分析オブジェクトの再利用
2. **Garbage Collection**: 不要オブジェクトの適切な解放
3. **Memory Profiling**: メモリ使用量の監視

## Security Considerations

### Input Validation

1. **SQL Injection Prevention**: マイグレーション内容の安全性チェック
2. **Path Traversal Prevention**: ファイル名の安全性検証
3. **Character Encoding**: 適切な文字エンコーディング処理

### File System Security

1. **Permission Checks**: ファイル作成権限の確認
2. **Path Validation**: 安全なファイルパスの生成
3. **Atomic Operations**: ファイル操作の原子性保証