# 🔧 トラブルシューティングガイド

## 📋 目次

### 🚨 緊急問題 (開発完全停止)
- [環境構築の問題](#-環境構築の問題) - mise、uv、bun、Task
- [Docker関連](#-docker関連) - コンテナ起動失敗

### ⚠️ 重要問題 (機能に影響)
- [フロントエンド問題](#-フロントエンド問題) - Next.js 15、TypeScript
- [バックエンド問題](#-バックエンド問題) - FastAPI、Python
- [データベース・マイグレーション](#-データベースマイグレーション) - PostgreSQL、自動マイグレーション
- [コード品質ツール](#-コード品質ツール) - Ruff、mypy、Biome

### 💡 軽微問題 (改善推奨)
- [CI/CD問題](#-cicd問題) - GitHub Actions（詳細は [CI_CD.md](./CI_CD.md) を参照）
- [環境固有の問題](#-環境固有の問題) - macOS、Windows、Linux

### 📚 サポート情報
- [クイック診断](#-クイック診断) - 緊急度判定、よくある問題
- [ヘルプとサポート](#-ヘルプとサポート) - ログ確認、環境リセット

---

## 🚀 クイック診断

### 緊急度判定
以下の症状に該当する場合は、該当する緊急度のセクションに直接移動してください：

🚨 **緊急 (開発完全停止)**:
- [ ] 開発サーバーが起動しない
- [ ] データベース接続が完全に失敗
- [ ] Docker環境が起動しない
- [ ] 必須ツール（mise、uv、bun）が見つからない

⚠️ **重要 (機能に影響)**:
- [ ] 一部機能が動作しない
- [ ] 品質ツール（Ruff、mypy、Biome）でエラーが大量発生
- [ ] マイグレーションが失敗
- [ ] ホットリロードが効かない

💡 **軽微 (改善推奨)**:
- [ ] パフォーマンスが遅い
- [ ] 警告メッセージが表示
- [ ] 設定の最適化が必要

### よくある問題クイックリファレンス

| 症状 | 緊急度 | ワンライナー解決策 |
|------|--------|-------------------|
| `bun: command not found` | 🚨 | `curl -fsSL https://bun.sh/install \| bash && source ~/.bashrc` |
| `uv: command not found` | 🚨 | `curl -LsSf https://astral.sh/uv/install.sh \| sh && source ~/.bashrc` |
| `mise: command not found` | 🚨 | `curl https://mise.run \| sh && source ~/.bashrc` |
| `task: command not found` | 🚨 | `mise install && source ~/.bashrc` |
| 別ターミナルでインストール済み | 🚨 | `source ~/.bashrc` または新しいターミナルを開く |
| `Port 5432 already in use` | ⚠️ | `sudo pkill -f postgres` |
| `Port 3000 already in use` | ⚠️ | `lsof -i :3000 \| grep LISTEN \| awk '{print $2}' \| xargs kill -9` |
| Docker権限エラー | ⚠️ | `sudo usermod -aG docker $USER` (要ログアウト) |
| `node_modules`問題 | 💡 | `rm -rf node_modules bun.lockb && bun install` |

### 環境情報の確認
```bash
# 基本環境確認
node --version    # Node.js 18以上が必要
python --version  # Python 3.11以上が必要
docker --version
docker compose version  # V2コマンドが利用可能か確認

# プロジェクト固有ツール
mise --version
cd frontend && bun --version
cd backend && task --version
cd backend && uv --version

# 環境診断スクリプト
check_environment() {
  echo "=== 🔍 環境診断 ==="
  echo "シェル: $SHELL"
  echo "Node.js: $(node --version 2>/dev/null || echo '❌ 未インストール')"
  echo "Python: $(python --version 2>/dev/null || echo '❌ 未インストール')"
  echo "Docker: $(docker --version 2>/dev/null || echo '❌ 未インストール')"
  echo "mise: $(mise --version 2>/dev/null || echo '❌ 未インストール')"
  echo "Bun: $(cd frontend && bun --version 2>/dev/null || echo '❌ 未インストール')"
  echo "uv: $(cd backend && uv --version 2>/dev/null || echo '❌ 未インストール')"
  echo "Task: $(cd backend && task --version 2>/dev/null || echo '❌ 未インストール')"
  
  echo ""
  echo "=== 📁 パス診断 ==="
  echo "PATH内のツール関連パス:"
  echo $PATH | tr ':' '\n' | grep -E "(mise|uv|bun|cargo|local)" || echo "❌ 関連パスが見つかりません"
  
  echo ""
  echo "=== 🔧 設定ファイル診断 ==="
  if [[ "$SHELL" == *"zsh"* ]]; then
    echo "~/.zshrc内のツール設定:"
    grep -E "(mise|uv|bun|cargo)" ~/.zshrc 2>/dev/null || echo "❌ 設定が見つかりません"
  else
    echo "~/.bashrc内のツール設定:"
    grep -E "(mise|uv|bun|cargo)" ~/.bashrc 2>/dev/null || echo "❌ 設定が見つかりません"
  fi
}
```

### 問題解決の優先順位

**このドキュメント**: 技術的・環境的問題の解決
**その他のドキュメント**:
- **[CI_CD.md](./CI_CD.md)**: 品質保証・GitHub Actions関連
- **[CLAUDE.md](./CLAUDE.md)**: AI分離開発での作業範囲・連携問題

### 問題の分類
問題が発生している場所を特定してから、該当セクションを参照してください：

- **🚨 緊急**: [環境構築の問題](#-環境構築の問題) → mise、uv、bun関連
- **🚨 緊急**: [Docker関連](#-docker関連) → コンテナ起動失敗
- **⚠️ 重要**: [フロントエンド問題](#-フロントエンド問題) → Next.js、TypeScript
- **⚠️ 重要**: [バックエンド問題](#-バックエンド問題) → FastAPI、Python
- **⚠️ 重要**: [データベース・マイグレーション](#-データベースマイグレーション) → PostgreSQL、Alembic

---

## 🏗️ 環境構築の問題

### 🚨 mise環境管理問題

**問題**: mise が見つからない
```bash
mise: command not found
```

**解決方法**:
```bash
# Case 1: 未インストールの場合
curl https://mise.run | sh

# Case 2: 別ターミナルでインストール済みの場合
source ~/.bashrc  # bash使用時
source ~/.zshrc   # zsh使用時

# または新しいターミナルを開く
# Cmd+T (macOS) / Ctrl+Shift+T (Linux)

# シェル統合設定（初回のみ）
echo 'eval "$(mise activate --shims zsh)"' >> ~/.zshrc  # zsh
echo 'eval "$(mise activate --shims bash)"' >> ~/.bashrc  # bash

# 設定反映確認
mise --version

# Pythonバージョンファイルサポート有効化
mise settings add idiomatic_version_file_enable_tools python
```

**問題**: mise install が失敗する
```bash
mise install
Error: failed to install python@3.11.8
```

**解決方法**:
```bash
# システム依存関係インストール (macOS)
brew install openssl readline sqlite3 xz zlib

# システム依存関係インストール (Ubuntu)
sudo apt-get update
sudo apt-get install -y make build-essential libssl-dev zlib1g-dev \
libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm \
libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev

# mise trust して再実行
cd backend
mise trust
mise install
```

**問題**: mise trust が必要
```bash
mise: .mise.toml is not trusted
```

**解決方法**:
```bash
cd backend
mise trust
mise install
```

### 🚨 Node.js / Python バージョン問題

**問題**: 推奨バージョンと異なるバージョンがインストールされている
```bash
# 期待: Node.js 18.0.0以上, Python 3.11以上
node --version  # v16.x.x など古いバージョン
python --version  # Python 3.9.x など古いバージョン
```

**解決方法 (mise使用推奨)**:
```bash
# mise経由でのインストール
cd backend
mise install  # .mise.tomlに基づいて自動インストール

# 手動インストール (mise未使用の場合)
# Node.js (nvm使用推奨)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Python (pyenv使用推奨)
curl https://pyenv.run | bash
pyenv install 3.11.8
pyenv global 3.11.8
```

### 🚨 ターミナル間でのパス不整合問題

**問題**: 別ターミナルでインストールしたツールが現在のターミナルで見つからない
```bash
# ターミナルA でインストール
curl https://mise.run | sh
mise --version  # 動作する

# ターミナルB で実行
mise --version  # mise: command not found
```

**解決方法**:
```bash
# 最も簡単な解決策: 新しいターミナルを開く
# Cmd+T (macOS) / Ctrl+Shift+T (Linux/Windows)

# または現在のターミナルで設定を再読み込み
source ~/.bashrc  # bash使用時
source ~/.zshrc   # zsh使用時

# 使用中のシェル確認
echo $SHELL

# 設定ファイル確認
# bash の場合
cat ~/.bashrc | grep -E "(mise|uv|bun)"

# zsh の場合  
cat ~/.zshrc | grep -E "(mise|uv|bun)"

# 環境変数確認
echo $PATH | tr ':' '\n' | grep -E "(mise|uv|bun|cargo)"
```

**予防策**:
```bash
# インストール後は必ず設定を反映
curl https://mise.run | sh && source ~/.bashrc
curl -LsSf https://astral.sh/uv/install.sh | sh && source ~/.bashrc
curl -fsSL https://bun.sh/install | bash && source ~/.bashrc

# または常に新しいターミナルで作業開始
```

### 🚨 パッケージマネージャー問題

**問題**: Bun が見つからない
```bash
bun: command not found
```

**解決方法**:
```bash
# Case 1: 未インストールの場合
curl -fsSL https://bun.sh/install | bash

# Case 2: 別ターミナルでインストール済みの場合
source ~/.bashrc  # bash使用時
source ~/.zshrc   # zsh使用時

# または新しいターミナルを開く

# パスの確認・追加（必要に応じて）
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc  # bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc   # zsh

# 設定反映
source ~/.bashrc  # または ~/.zshrc

# インストール確認
bun --version
```

**問題**: uv が見つからない
```bash
uv: command not found
```

**解決方法**:
```bash
# Case 1: 未インストールの場合
curl -LsSf https://astral.sh/uv/install.sh | sh

# Case 2: 別ターミナルでインストール済みの場合
source $HOME/.cargo/env
# または
source ~/.bashrc  # bash使用時
source ~/.zshrc   # zsh使用時

# Case 3: mise経由でインストール
cd backend
mise install  # .mise.tomlのuv設定に基づいてインストール

# 新しいターミナルを開いて確認
uv --version

# パスが通らない場合の手動追加
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc  # bash
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc   # zsh
source ~/.bashrc  # または ~/.zshrc
```

**問題**: Task が見つからない
```bash
task: command not found
```

**解決方法**:
```bash
# Case 1: mise経由でインストール (推奨)
cd backend
mise install

# Case 2: 別ターミナルでmise install済みの場合
source ~/.bashrc  # bash使用時
source ~/.zshrc   # zsh使用時
# または新しいターミナルを開く

# Case 3: 手動インストール (macOS)
brew install go-task/tap/go-task

# Case 4: 手動インストール (Linux)
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b ~/.local/bin

# パスが通らない場合
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc  # bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc   # zsh
source ~/.bashrc  # または ~/.zshrc

# インストール確認
task --version
```

---

## 🐳 Docker関連

### ポート競合エラー

**問題**: PostgreSQL ポート競合
```bash
Error: Port 5432 is already in use
```

**解決方法**:
```bash
# ポート使用プロセス確認
sudo lsof -i :5432

# PostgreSQL プロセス停止
sudo pkill -f postgres

# または異なるポートを使用
# backend/docker/docker-compose.yml を編集
ports:
  - "5433:5432"  # ホスト側を5433に変更
```

**問題**: フロントエンド開発サーバーのポート競合
```bash
Error: Port 3000 is already in use
```

**解決方法**:
```bash
# プロセス確認・停止
lsof -i :3000
kill -9 <PID>

# または別ポートで起動
cd frontend
bun run dev -- --port 3001
```

### Docker権限エラー

**問題**: Docker daemon接続エラー
```bash
permission denied while trying to connect to the Docker daemon
```

**解決方法**:

**Linux**:
```bash
# Dockerグループに追加
sudo usermod -aG docker $USER

# ログアウト・ログイン後に確認
docker ps
```

**macOS**:
```bash
# Docker Desktop を再起動
# または Docker Desktop の設定でリソース制限を確認
```

### ⚠️ Docker Compose 問題

**問題**: Docker Compose ファイルが見つからない
```bash
no such file or directory: docker-compose.yml
```

**解決方法**:
```bash
# 正しいパスで実行
cd backend
task docker:up

# または直接指定 (V2コマンド推奨)
docker compose -f backend/docker/docker-compose.yml up

# 旧V1コマンド (非推奨)
docker-compose -f backend/docker/docker-compose.yml up
```

**問題**: Docker Compose V1/V2の違い
```bash
docker-compose: command not found
# または
Unknown command: docker-compose
```

**解決方法**:
```bash
# Docker Compose V2確認
docker compose version

# V2が利用可能な場合 (推奨)
docker compose up
docker compose down
docker compose logs

# V1からV2への移行
# ~/.bashrc または ~/.zshrcに追加
alias docker-compose='docker compose'

# プロジェクトのTaskfile.ymlは既にV2対応済み
cd backend
task docker:up  # 内部でdocker composeを使用
```

---

## ⚛️ フロントエンド問題

### Bun インストール・実行問題

**問題**: 依存関係インストール失敗
```bash
error: failed to install dependencies
```

**解決方法**:
```bash
cd frontend

# キャッシュクリア
bun pm cache rm

# node_modules 完全削除
rm -rf node_modules bun.lockb

# 再インストール
bun install
```

**問題**: メモリ不足エラー
```bash
FATAL ERROR: Reached heap limit Allocation failed
```

**解決方法**:
```bash
# Node.js メモリ制限を増加
export NODE_OPTIONS="--max-old-space-size=4096"
bun run dev
```

### ⚠️ Next.js 15 App Router 問題

**問題**: Server Components エラー
```bash
Error: Cannot use useState in Server Component
```

**解決方法**:
```bash
# Client Componentに変更
# ファイル先頭に追加
'use client'

# または適切なコンポーネント分離
# Server Component: データフェッチ、静的表示
# Client Component: インタラクション、状態管理
```

**問題**: ホットリロードが効かない
```bash
# ファイル変更しても画面が更新されない
```

**解決方法**:
```bash
# Next.js 15対応のポーリング設定
cd frontend

# next.config.ts を更新
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  },
}

# 開発サーバー再起動
bun run dev
```

**問題**: App Router のルーティングエラー
```bash
Error: Page "/api/users" does not exist
```

**解決方法**:
```bash
# App Router構造確認
cd frontend/src/app

# API Routes: app/api/users/route.ts
# Pages: app/users/page.tsx
# Layouts: app/users/layout.tsx

# 正しいファイル構造例
src/app/
├── api/
│   └── users/
│       └── route.ts        # API endpoint
├── users/
│   ├── page.tsx           # /users page
│   └── layout.tsx         # users layout
└── layout.tsx             # root layout
```

### TypeScript 型エラー

**問題**: 大量の型エラーが発生
```bash
error TS2307: Cannot find module '@/components/ui/button'
```

**解決方法**:
```bash
cd frontend

# TypeScript 設定確認
cat tsconfig.json

# パスマッピング確認
# tsconfig.json の "paths" が正しく設定されているか確認

# 型生成強制実行
bun run typecheck
```

---

## 🚀 バックエンド問題

### FastAPI 起動失敗

**問題**: FastAPI サーバーが起動しない
```bash
ModuleNotFoundError: No module named 'fastapi'
```

**解決方法**:
```bash
cd backend

# 仮想環境の確認
uv sync --group dev

# 依存関係一覧確認
uv pip list

# 明示的に FastAPI インストール
uv add fastapi uvicorn
```

**問題**: ポート8000が使用中
```bash
OSError: [Errno 48] Address already in use
```

**解決方法**:
```bash
# プロセス確認
lsof -i :8000

# 別ポートで起動
cd backend
uv run uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload
```

### uv 環境問題

**問題**: uv sync が失敗する
```bash
error: failed to solve: no solution found
```

**解決方法**:
```bash
cd backend

# キャッシュクリア
uv cache clean

# ロックファイル削除して再生成
rm uv.lock
uv sync --group dev

# Python バージョン確認
python --version  # 3.11以上であることを確認
```

**問題**: 依存関係の競合
```bash
error: package versions are incompatible
```

**解決方法**:
```bash
# 依存関係の詳細確認
uv tree

# 問題のあるパッケージを更新
uv add package-name --upgrade

# または pyproject.toml を手動確認・修正
```

---

## 🗄️ データベース・マイグレーション

### ⚠️ 自動マイグレーションツール特有の問題

**問題**: Decision Tree命名システムでエラー
```bash
❌ 複雑すぎる変更パターンです: 混合アクション検出
```

**解決方法**:
```bash
cd backend

# 変更を小さく分割して段階的実行
# 1. テーブル作成のみ
task migrate:generate
task migrate:upgrade

# 2. カラム追加のみ  
task migrate:generate
task migrate:upgrade

# 3. インデックス作成のみ
task migrate:generate
task migrate:upgrade
```

**問題**: マイグレーション安全性チェック失敗
```bash
❌ 見つからないマイグレーションファイル: abcd1234_create_users_table.py
```

**解決方法**:
```bash
cd backend

# 安全性チェック実行
task migrate:check

# 対処方法の表示に従う:
# Option 1: 削除されたファイルを復元
git checkout HEAD~1 -- src/db/migrations/versions/abcd1234_create_users_table.py

# Option 2: データベースリセット（開発環境推奨）
task migrate:reset
task migrate

# Option 3: データベース状態を手動調整
# PostgreSQLに接続してalembic_versionテーブルを確認
docker exec -it <postgres-container> psql -U postgres -d fastapi_db
# SELECT * FROM alembic_version;
# DELETE FROM alembic_version WHERE version_num = 'abcd1234';
```

**問題**: 自動命名が期待と異なる
```bash
Generated: change_mixed_actions_20250127_123456.py
Expected: add_email_column_20250127_123456.py
```

**解決方法**:
```bash
# 生成されたファイル名を確認
ls backend/src/db/migrations/versions/

# 必要に応じて手動でファイル名変更
cd backend/src/db/migrations/versions/
mv change_mixed_actions_20250127_123456.py add_email_column_20250127_123456.py

# ファイル内のrevision IDも更新
# revision = 'abcd1234'  # ファイル名と一致させる

# マイグレーション適用
cd backend
task migrate:upgrade
```

### ⚠️ マイグレーション失敗

**問題**: リビジョンが見つからない
```bash
Can't locate revision identified by 'xxxxx'
```

**解決方法**:
```bash
cd backend

# マイグレーション整合性チェック
task migrate:check

# 履歴確認
task migrate:history

# データベースリセット（開発環境のみ）
task migrate:reset

# 新しいマイグレーション生成
task migrate:generate
```

**問題**: マイグレーションファイルが削除された
```bash
❌ 見つからないマイグレーションファイル: abcd1234
```

**解決方法**:
```bash
# 安全性チェック実行
task migrate:check

# 対処方法の表示に従う:
# 1. 削除されたファイルを復元
# 2. データベースリセット
# 3. データベース状態を手動調整

# 通常は開発環境でリセットが最も安全
task migrate:reset
task migrate
```

### PostgreSQL 接続問題

**問題**: データベース接続失敗
```bash
psycopg2.OperationalError: could not connect to server
```

**解決方法**:
```bash
# Docker コンテナ確認
docker ps

# PostgreSQL コンテナが起動していない場合
cd backend
task docker:up

# 接続設定確認
# backend/src/db/database.py の DATABASE_URL を確認

# 手動接続テスト
docker exec -it <postgres-container-id> psql -U postgres -d fastapi_db
```

**問題**: データベース作成権限エラー
```bash
permission denied to create database
```

**解決方法**:
```bash
# PostgreSQL コンテナに接続
docker exec -it <postgres-container-id> psql -U postgres

# 権限確認・付与
\du  -- ユーザー一覧
ALTER USER postgres CREATEDB;

# または環境変数確認
# docker-compose.yml の POSTGRES_USER, POSTGRES_PASSWORD
```

---

## 🔍 コード品質ツール

### Ruff エラー

**問題**: 大量の lint エラー
```bash
Found 120+ lint violations
```

**解決方法**:
```bash
cd backend

# 自動修正可能なエラーを修正
task lint:fix

# フォーマット実行
task format

# 全体チェック
task check:all

# 手動修正が必要なエラーは個別対応
```

**問題**: Ruff 設定エラー
```bash
error: Invalid configuration
```

**解決方法**:
```bash
# pyproject.toml の [tool.ruff] セクション確認
cat pyproject.toml | grep -A 10 "tool.ruff"

# 設定ファイルの文法チェック
ruff check --config pyproject.toml
```

### mypy 型チェックエラー

**問題**: 型注釈不足エラー
```bash
error: Function is missing a type annotation
```

**解決方法**:
```bash
# 段階的修正
cd backend

# まず自動修正
task fix:all

# 型チェック実行
task typecheck

# 手動で型注釈追加
# 例: def function_name() -> None:
#     return None
```

**問題**: mypy 設定が厳格すぎる
```bash
Too many errors, stopping
```

**解決方法**:
```bash
# pyproject.toml の mypy 設定確認
[tool.mypy]
strict = true  # 必要に応じて false に変更

# 特定ファイルの型チェック無効化（最終手段）
# type: ignore コメント追加
```

### Biome 問題（フロントエンド）

**問題**: Biome フォーマットエラー
```bash
Some files contain syntax errors
```

**解決方法**:
```bash
cd frontend

# 設定確認
cat biome.json

# 段階的修正
bun run format:fix
bun run check:fix

# 個別ファイル修正
bun x @biomejs/biome format --write src/app/page.tsx
```

---

## 🔄 CI/CD問題

> **📋 詳細な品質保証・CI/CD情報**: [CI_CD.md](./CI_CD.md) を参照してください  
> このセクションでは基本的なトラブルシューティングのみ扱います

### GitHub Actions 失敗

**問題**: 環境変数が設定されていない
```bash
Error: Environment variable DATABASE_URL is not set
```

**解決方法**:
```bash
# GitHub リポジトリの Settings > Secrets and variables > Actions
# 必要な環境変数を追加:
# - DATABASE_URL
# - NODE_ENV
# - その他必要な秘匿情報
```

**問題**: Docker 権限エラー (CI)
```bash
permission denied while trying to connect to the Docker daemon
```

**解決方法**:
```yaml
# .github/workflows/*.yml を確認
# setup-docker-buildx action を追加
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2
```

**問題**: タイムアウトエラー
```bash
The job running on runner GitHub Actions X has exceeded the maximum execution time
```

**解決方法**:
```yaml
# ワークフローファイルでタイムアウト延長
jobs:
  test:
    timeout-minutes: 30  # デフォルト60分から調整
```

---

## 🖥️ 環境固有の問題

### macOS

**問題**: Xcode Command Line Tools が必要
```bash
xcode-select: error: tool 'git' requires Xcode
```

**解決方法**:
```bash
# Command Line Tools インストール
xcode-select --install

# 確認
xcode-select -p
```

**問題**: Homebrew 関連
```bash
brew: command not found
```

**解決方法**:
```bash
# Homebrew インストール
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# パス追加 (Apple Silicon Mac)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Windows (WSL推奨)

**問題**: WSL でのファイル権限問題
```bash
Permission denied
```

**解決方法**:
```bash
# ファイル権限修正
chmod -R 755 ./
chown -R $USER:$USER ./

# WSL と Windows ファイルシステムの違いに注意
# プロジェクトは WSL ファイルシステム内で開発
```

**問題**: Docker Desktop 統合問題
```bash
docker: command not found (in WSL)
```

**解決方法**:
```bash
# Docker Desktop の設定確認
# Settings > Resources > WSL Integration
# Ubuntu (or your distro) を有効化

# WSL 内で確認
docker --version
docker compose version
```

### Linux

**問題**: 権限設定
```bash
permission denied
```

**解決方法**:
```bash
# Docker グループに追加
sudo usermod -aG docker $USER

# ファイル権限
sudo chown -R $USER:$USER ./

# ログアウト・ログインして確認
groups  # docker グループが含まれているか確認
```

**問題**: パッケージマネージャー依存関係
```bash
E: Unable to locate package
```

**解決方法**:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y curl git build-essential

# CentOS/RHEL
sudo yum update
sudo yum groupinstall "Development Tools"

# Arch Linux
sudo pacman -Syu base-devel git curl
```

---

## 🆘 ヘルプとサポート

### ログ確認方法

```bash
# マイグレーションログ
cat backend/src/db/logs/migration_$(date +%Y%m%d).log

# Docker ログ
docker compose -f backend/docker/docker-compose.yml logs

# アプリケーションログ
cd backend && task dev  # 詳細ログが表示される

# システムログ
sudo journalctl -u docker  # Linux
```

### 環境リセット方法

```bash
# 完全リセット（開発環境のみ）
# ⚠️ データが削除されるため注意

# バックエンド
cd backend
task migrate:reset
task clean
rm -rf .pytest_cache .mypy_cache .ruff_cache

# フロントエンド  
cd frontend
rm -rf node_modules bun.lockb .next
bun install

# Docker
docker compose -f backend/docker/docker-compose.yml down -v
docker system prune -a  # 全Docker データ削除（注意）
```

### デバッグモード

```bash
# 詳細ログ出力
VERBOSE=1 task migrate
DEBUG=1 task docker:up

# Python デバッグ
cd backend
PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 task dev

# Node.js デバッグ
cd frontend  
NODE_ENV=development DEBUG=* bun run dev
```

### イシュー報告テンプレート

問題が解決しない場合は、以下のテンプレートでGitHub Issueを作成してください：

```markdown
## 🐛 バグ報告

### 環境情報
- **OS**: (macOS 14.0 / Ubuntu 22.04 / Windows 11 WSL など)
- **Node.js**: `node --version`
- **Python**: `python --version`  
- **Docker**: `docker --version`
- **Bun**: `bun --version`
- **uv**: `uv --version`

### 実行したコマンド
```bash
# 問題が発生したコマンドを記載
task docker:up
```

### エラーメッセージ
```
# 完全なエラーメッセージを貼り付け
Error: Port 5432 is already in use
```

### 期待した動作
- 正常にDockerコンテナが起動する
- PostgreSQLに接続できる

### 実際の動作
- ポート競合エラーでコンテナ起動失敗

### 追加情報
- 初回環境構築時の問題
- 以前は動作していたが突然エラーになった
- 特定の操作後に問題が発生
```

### コミュニティサポート

- **GitHub Discussions**: 技術的な質問や議論
- **GitHub Issues**: バグ報告や機能要望
- **README.md**: 基本的な使用方法
- **各コンポーネントのREADME**: 詳細な技術情報

---

**最終更新**: 2025年1月
**メンテナンス**: プロジェクト使用中に発見された新しい問題を随時追加