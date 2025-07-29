# Backend

FastAPI + Python + uvを使用したモダンなバックエンドテンプレートです。

## 技術スタック

- **Framework**: FastAPI
- **Language**: Python 3.11
- **Database**: PostgreSQL
- **Package Manager**: uv
- **Task Runner**: Task
- **Linter/Formatter**: Ruff
- **Type Checker**: mypy
- **Testing**: pytest
- **Migration**: Alembic + 自動マイグレーションツール
- **Docker**: Docker Compose

## 開発環境のセットアップ

### 前提条件

- mise
- Python 3.11（miseで自動インストール）
- Task（miseで自動インストール）
- uv（miseで自動インストール）
- ruff(uvでインストール)

### インストール

```bash
# miseのインストール（初回のみ）
brew install mise  # macOSの場合
# または
curl https://mise.run | sh

# miseのシェル統合（初回のみ）
echo 'eval "$(mise activate --shims zsh)"' >> ~/.zshrc  # zshの場合
source ~/.zshrc

# Pythonバージョンファイルサポートの有効化（初回のみ）
mise settings add idiomatic_version_file_enable_tools python

# プロジェクトディレクトリに移動
cd backend

# miseツールの自動インストール
mise trust && mise install

# 依存関係のインストール
task install
```

### 開発サーバーの起動

```bash
task dev
```

http://localhost:8000 でAPIにアクセスできます。

## 利用可能なコマンド

### 開発

```bash
task install       # 依存関係をインストール
task dev           # 開発サーバーを起動
task test          # pytestでテスト実行
```

### コード品質

```bash
task lint          # Ruffでリンティング
task format        # Ruffでフォーマット
task typecheck     # mypyで型チェック
```

### Docker

```bash
task docker:build  # Dockerイメージをビルド
task docker:up     # Dockerコンテナを起動
task docker:down   # Dockerコンテナを停止
task clean         # 生成ファイルをクリーンアップ
```

### データベース・マイグレーション

```bash
task migrate       # 自動マイグレーション（生成＋適用）
task migrate:generate    # マイグレーション生成のみ
task migrate:upgrade     # 手動アップグレード
task migrate:downgrade   # 1つ前にダウングレード
task migrate:status      # 現在の状態表示
task migrate:history     # 履歴表示
task migrate:reset       # データベースリセット
```

## プロジェクト構成

```
backend/
├── src/                    # ソースコード
│   ├── main.py            # FastAPIアプリケーション
│   ├── api/               # APIルート
│   ├── models/            # Pydanticモデル
│   ├── services/          # ビジネスロジック
│   ├── db/                # データベース関連
│   │   ├── database.py    # データベース接続
│   │   ├── models/        # SQLAlchemyモデル
│   │   └── migrations/    # Alembicマイグレーション
│   └── script/            # ユーティリティスクリプト
│       └── auto_migrate/  # 自動マイグレーションツール
├── tests/                  # テストコード
├── docker/                 # Docker設定
│   ├── docker-compose.yml # PostgreSQL + FastAPI
│   └── Dockerfile         # FastAPIコンテナ
├── pyproject.toml          # プロジェクト設定
├── .mise.toml              # mise設定
├── .python-version         # Pythonバージョン
└── Taskfile.yml            # タスク定義
```

## コーディング規約

このプロジェクトは厳密なコーディング規約に従っています：

- **型アノテーション**: すべての関数に適切な型アノテーションが必要
- **リンティング**: Ruffによる自動リンティング
- **フォーマット**: Ruffによる自動フォーマット
- **型チェック**: mypyによる厳格な型チェック

### 型アノテーション例

```python
from typing import Any, Dict

# 良い例
def get_user_by_id(user_id: int) -> Dict[str, Any]:
    return {"id": user_id, "name": "User"}

# 悪い例
def get_user_by_id(user_id):
    return {"id": user_id, "name": "User"}
```

詳細な設定は `pyproject.toml` を参照してください。

## データベース・マイグレーション

### 自動マイグレーションシステム

このプロジェクトには、SQLAlchemyモデルの変更を自動的に検出し、意味のあるマイグレーションファイル名を生成する高度なマイグレーションシステムが組み込まれています。

#### マイグレーションファイル命名規則

マイグレーションファイルは以下のDecision Treeに基づいて自動命名されます：

```
Decision Tree:
単一変更 → {action}_{name}_{target}
同一テーブル複数同種 → {action}_{count}{target}_{table}_table
同一テーブル複数異種 → change_{count}items_{table}_table
複数テーブル同種 → {action}_{target}_{count}tables
複数テーブル異種 → change_mixed_actions
```

**具体的な命名例**:

| 変更内容 | 生成されるファイル名 | 説明 |
|---------|-------------------|------|
| 単一テーブル作成 | `create_users_table` | 1つのテーブルを作成 |
| 単一カラム追加 | `add_email_column` | 1つのカラムを追加 |
| 同一テーブルに複数カラム追加 | `add_3columns_users_table` | usersテーブルに3つのカラム追加 |
| 同一テーブルに異なる変更 | `change_2items_users_table` | usersテーブルにカラム追加とインデックス作成 |
| 複数テーブル作成 | `create_2tables` | 2つのテーブルを作成 |
| 複数テーブルに複数種類の変更 | `change_mixed_actions` | 複雑な混合変更 |

**アクション優先順位**: create > add > modify > delete

**重複語回避**: `create_table_2tables` → `create_2tables` のように自動的に重複を回避

#### 基本的な使用方法

```bash
# モデルを変更後、自動でマイグレーション生成・適用
task migrate

# マイグレーション生成のみ（適用しない）
task migrate:generate

# 現在のマイグレーション状態を確認
task migrate:status
```

#### 新しいモデルの追加

新しいSQLAlchemyモデルを追加する場合は、以下の3つのファイルを必ず更新してください：

1. `src/db/base.py` - Alembic検出用のインポート
2. `src/db/migrations/env.py` - マイグレーション環境設定
3. `src/db/models/__init__.py` - モデルエクスポート

詳細は `src/db/models/MODEL_MIGRATION_GUIDE.md` を参照してください。

## トラブルシューティング

- **`task: command not found`**: miseのセットアップを確認し、ターミナルを再起動
- **依存関係の問題**: `task clean && rm -rf .venv && task install` を実行
- **Dockerの問題**: `task docker:build --no-cache` でキャッシュなしリビルド
- **リンティングエラー**: `task format` を実行し、残りの問題に対処
- **型チェックエラー**: 適切な型アノテーションを追加

## 参考リンク

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [uvicorn](https://www.uvicorn.org/)
- [Ruff](https://docs.astral.sh/ruff/)
- [mypy](https://mypy.readthedocs.io/)
- [Task](https://taskfile.dev/)
- [mise](https://mise.jdx.dev/)
- [uv](https://github.com/astral-sh/uv)