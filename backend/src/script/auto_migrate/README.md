# Auto Migration Tool

SQLAlchemyモデルの変更を自動的に検出し、意味のあるマイグレーションメッセージを生成するツールです。

## ✨ 特徴

- 🤖 **自動メッセージ生成**: データベース変更を解析して適切なマイグレーションメッセージを自動生成
- 📝 **インテリジェントファイル命名**: Decision Treeに基づく意味のあるファイル名を自動生成
- 📋 **未適用マイグレーション検出**: downgrade後も自動的に未適用マイグレーションを検出・適用
- 🛡️ **堅牢なエラーハンドリング**: 様々な状況に対応した例外処理
- 📊 **詳細ログ**: コンソールとファイルの両方に詳細なログを出力
- ⚡ **高速実行**: 効率的なマイグレーション処理
- 🔄 **重複語回避**: 冗長なファイル名を自動的に簡潔化
- 📈 **優先順位システム**: 複数変更時の適切な命名判定

## 🔧 サポートする変更タイプ

- テーブルの作成・削除
- カラムの追加・削除・変更
- インデックスの作成・削除
- 外部キー制約の追加・削除
- チェック制約の追加・削除

## 🚀 使用方法

### Task コマンド（推奨）

```bash
# 基本実行（マイグレーション生成 + データベース更新）
task migrate

# マイグレーション生成のみ（データベース更新なし）
task migrate:generate

# 現在のマイグレーション状態確認
task migrate:status

# 1つ前のマイグレーションにダウングレード
task migrate:downgrade

# 全てのマイグレーションをダウングレード（データベースリセット）
task migrate:reset

# マイグレーション履歴表示
task migrate:history

# 手動アップグレード（全て適用）
task migrate:upgrade
```

### 直接実行

```bash
# 基本実行
uv run python -m src.script.auto_migrate

# マイグレーション生成のみ
uv run python -m src.script.auto_migrate --no-upgrade

# 現在のマイグレーション状態確認
uv run python -m src.script.auto_migrate --status
```

## 📋 コマンド一覧

| Task コマンド | 説明 |
|-------------|------|
| `task migrate` | 自動マイグレーション（生成＋適用） |
| `task migrate:generate` | マイグレーション生成のみ |
| `task migrate:upgrade` | 手動アップグレード（全て適用） |
| `task migrate:downgrade` | 1つ前にダウングレード |
| `task migrate:reset` | データベースリセット（全てダウングレード） |
| `task migrate:status` | 現在の状態表示 |
| `task migrate:history` | 履歴表示 |

## 🎯 動作パターン

### 1. 変更がない場合
```bash
$ task migrate
✅ データベースは既に最新の状態です
```

### 2. 新しい変更がある場合
```bash
$ task migrate
✅ マイグレーション生成完了: Add email to users
📄 ファイルパス: src/db/migrations/versions/0005_add_email_column.py
🎉 マイグレーション完了!
```

### 3. 未適用マイグレーションがある場合
```bash
$ task migrate
📋 未適用のマイグレーションが存在します。先にアップグレードを実行します。
🎉 未適用のマイグレーション適用完了!
```

## 📁 ファイル構成

```
src/script/auto_migrate/
├── __init__.py           # モジュール初期化・エクスポート
├── __main__.py           # CLI エントリーポイント
├── auto_migrate.py       # メインロジック
├── config.py            # 設定管理
├── test_auto_migrate.py # テストファイル
└── README.md           # このファイル
```

## 🔄 ワークフロー例

### 開発時の基本ワークフロー

```bash
# 1. モデルを変更
# src/db/models/sample.py を編集

# 2. マイグレーション生成・適用
task migrate

# 3. 必要に応じて生成されたファイルを確認・編集
# src/db/migrations/versions/内のファイルを確認
```

### downgrade後のワークフロー

```bash
# 1. 意図的にダウングレード
task migrate:downgrade

# 2. 最新状態に戻す（自動的に未適用を検出・適用）
task migrate
```

### データベースリセット

```bash
# 全てのマイグレーションを削除（初期状態に戻す）
task migrate:reset

# 再度最新状態にする
task migrate
```

## 📝 ファイル命名システム

### Decision Tree による自動命名

マイグレーションファイルは以下のDecision Treeに基づいて自動命名されます：

```
Decision Tree:
単一変更 → {action}_{name}_{target}
同一テーブル複数同種 → {action}_{count}{target}_{table}_table
同一テーブル複数異種 → change_{count}items_{table}_table
複数テーブル同種 → {action}_{target}_{count}tables
複数テーブル異種 → change_mixed_actions
```

### 生成されるファイル名の例

| 変更内容 | 生成されるファイル名 | 説明 |
|---------|-------------------|------|
| 単一テーブル作成 | `0001_create_users_table.py` | 1つのテーブルを作成 |
| 単一カラム追加 | `0002_add_email_column.py` | 1つのカラムを追加 |
| 同一テーブルに複数カラム追加 | `0003_add_3columns_users_table.py` | usersテーブルに3つのカラム追加 |
| 同一テーブルに異なる変更 | `0004_change_2items_users_table.py` | usersテーブルにカラム追加とインデックス作成 |
| 複数テーブル作成 | `0005_create_2tables.py` | 2つのテーブルを作成 |
| 複数テーブルに複数種類の変更 | `0006_change_mixed_actions.py` | 複雑な混合変更 |

### 生成されるメッセージの例

| 変更内容 | 生成されるメッセージ |
|---------|-------------------|
| テーブル作成 | `Create users table` |
| カラム追加 | `Add email to users` |
| カラム削除 | `Remove password from users` |
| カラム変更 | `Modify email in users` |
| インデックス作成 | `Add index to users` |
| 外部キー追加 | `Add foreign key to posts` |
| 複数変更（少数） | `Create users table; Add email to posts` |
| 複数変更（多数） | `Multiple schema updates (5 changes)` |

### 命名システムの特徴

- **アクション優先順位**: create > add > modify > delete
- **重複語回避**: `create_table_2tables` → `create_2tables` のように自動簡潔化
- **一貫性**: 同じパターンの変更は常に同じ命名規則
- **可読性**: ファイル名から変更内容が即座に理解可能

## ⚙️ 設定

### 環境変数

| 環境変数 | 説明 | デフォルト値 |
|---------|------|------------|
| `DATABASE_URL` | データベース接続URL | `postgresql://user:root@localhost:5432/mydb` |

### カスタム設定例

```python
from pathlib import Path
from src.script.auto_migrate.config import MigrationConfig

# カスタム設定
config = MigrationConfig(
    db_path=Path("custom/db/path"),
    versions_path=Path("custom/versions/path"),
    alembic_command=["poetry", "run", "alembic"],
    # その他の設定...
)
```

## 📊 ログ

ログは以下の場所に保存されます：
- **ファイルログ**: `src/db/logs/migration_YYYYMMDD.log`
- **コンソールログ**: 実行時にリアルタイム表示

## 🧪 テスト

```bash
# テスト実行
uv run pytest src/script/auto_migrate/test_auto_migrate.py -v

# カバレッジ付きテスト実行
uv run pytest src/script/auto_migrate/test_auto_migrate.py --cov=src.script.auto_migrate
```

## 🐛 トラブルシューティング

### よくあるエラーと対処法

**1. "マイグレーション生成に失敗"**
- Alembicの設定を確認（`alembic.ini`、`env.py`）
- データベース接続を確認（`DATABASE_URL`）
- モデルのインポート設定を確認（`env.py`でモデルをインポート）

**2. "Target database is not up to date"**
- `task migrate`を実行（自動的に未適用マイグレーションを検出・適用）

**3. "変更が検出されませんでした"**
- モデルファイルが正しく保存されているか確認
- Alembicがモデルを認識できているか確認

### デバッグモード

詳細なログを確認する場合：

```python
import logging
logging.getLogger("migration_analyzer").setLevel(logging.DEBUG)
```

## 🔧 開発者向け情報

### 新しい変更タイプの追加

1. `config.py`の`patterns`辞書に正規表現パターンを追加
2. `auto_migrate.py`の`_analyze_migration_content`メソッドに解析ロジックを追加
3. `_generate_message_from_changes`メソッドにメッセージ生成ロジックを追加
4. `_generate_filename_from_changes`メソッドに命名ロジックを追加
5. `FilenamingConstants`クラスに必要な定数を追加
6. テストケースを追加

### 命名システムのカスタマイズ

```python
# FilenamingConstants クラスでの設定例
class FilenamingConstants:
    # アクション優先度の変更
    ACTION_PRIORITY = {
        "create": 4,
        "add": 3,
        "modify": 2,
        "delete": 1,
        "custom": 5,  # 新しいアクション追加
    }
    
    # 新しい命名パターンの追加
    CUSTOM_PATTERN = "custom_action_pattern"
```

### アーキテクチャ

- **MigrationAnalyzer**: メインクラス、マイグレーション処理の中心
- **MigrationResult**: 処理結果を表すデータクラス
- **MigrationStatus**: Enumによる状態管理
- **MigrationConfig**: 設定管理クラス
- **FilenamingConstants**: ファイル命名用の定数管理
- **Decision Tree Engine**: 変更パターンに基づく自動命名システム

### 命名システムの内部構造

```python
# 変更分析
by_table: Dict[str, List[MigrationChange]]  # テーブル別グループ化
by_action: Dict[str, List[MigrationChange]] # アクション別グループ化

# 判定フラグ
is_single_table = len(by_table) == 1
is_single_action = len(by_action) == 1

# Decision Tree による命名決定
if len(changes) == 1:
    return f"{action}_{name}_{target}"
elif is_single_table and is_single_action:
    return f"{action}_{count}{target}_{table}_table"
# ... その他のパターン
```

## ⚠️ 注意事項

- **手動確認**: 生成されたマイグレーションファイルは必ず手動で確認
- **バックアップ**: 重要なデータは別途バックアップを取得
- **並行実行**: 複数のマイグレーションを同時実行しない
- **レビュー**: 生成されたマイグレーションは必ずコードレビューを行う
- **編集自由**: ファイル名、メッセージ、マイグレーション内容は手動で編集可能
- **命名の一貫性**: 手動でファイル名を変更する場合は、プロジェクトの命名規則に従う
- **Decision Tree理解**: 自動命名システムの動作を理解してから手動調整を行う

## 🏗️ CI/CD での使用例

### GitHub Actions

```yaml
- name: Check pending migrations
  run: |
    if ! task migrate:status | grep -q "最新の状態"; then
      echo "未適用のマイグレーションがあります"
      exit 1
    fi

- name: Apply migrations in production
  run: task migrate
```

## 📄 ライセンス

このツールはプロジェクトのライセンスに従います。