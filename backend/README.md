# Backend

FastAPI + Python + uvを使用したモダンなバックエンドテンプレートです。

## 技術スタック

- **Framework**: FastAPI
- **Language**: Python 3.11
- **Package Manager**: uv
- **Task Runner**: Task
- **Linter/Formatter**: Ruff
- **Type Checker**: mypy
- **Testing**: pytest
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
```

### Docker

```bash
task docker:build  # Dockerイメージをビルド
task docker:up     # Dockerコンテナを起動
task clean         # 生成ファイルをクリーンアップ
```

## プロジェクト構成

```
backend/
├── src/                    # ソースコード
│   └── main.py            # FastAPIアプリケーション
├── tests/                  # テストコード
├── docker/                 # Docker設定
│   ├── docker-compose.yml
│   └── Dockerfile
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