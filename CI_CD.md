# 🔄 CI/CD・品質保証ガイド

## 📋 目次
- [GitHub Actions による品質担保](#-github-actions-による品質担保)
- [環境変数管理](#-環境変数管理)
- [開発環境でのデータベースマイグレーション](#-開発環境でのデータベースマイグレーション)
- [品質チェック・デバッグ](#-品質チェックデバッグ)

---

## 🔄 GitHub Actions による品質担保

### フロントエンド品質チェック

**ファイル作成**: `.github/workflows/frontend.yml`

```yaml
name: Frontend Quality Check

on:
  push:
    paths: ['frontend/**']
  pull_request:
    paths: ['frontend/**']

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Install dependencies
        run: cd frontend && bun install
        
      - name: TypeScript型チェック
        run: cd frontend && bun run typecheck
        
      - name: Biome lint・formatチェック
        run: cd frontend && bun run check
        
      - name: テスト実行
        run: cd frontend && bun run test
        
      - name: ビルド確認
        run: cd frontend && bun run build
```

### バックエンド品質チェック

**ファイル作成**: `.github/workflows/backend.yml`

```yaml
name: Backend Quality Check

on:
  push:
    paths: ['backend/**']
  pull_request:
    paths: ['backend/**']

jobs:
  quality-check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      
      - name: Install uv
        uses: astral-sh/setup-uv@v2
        
      - name: Set up Python
        run: uv python install 3.11
        
      - name: Install dependencies
        run: cd backend && uv sync --group dev
        
      - name: Ruff lint・formatチェック + mypy型チェック
        run: cd backend && uv run task check:all
        
      - name: pytest実行
        run: cd backend && uv run task test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          
      - name: マイグレーション安全性チェック
        run: cd backend && uv run task migrate:check
```

### 品質チェックの自動化について

**実行タイミング**:
- `frontend/` または `backend/` ディレクトリの変更時のみ実行
- プルリクエスト作成時・更新時
- メインブランチへのプッシュ時

**チェック内容**:
- **フロントエンド**: TypeScript型チェック、Biome品質チェック、テスト、ビルド確認
- **バックエンド**: mypy型チェック、Ruff品質チェック、pytest、マイグレーション安全性

---

## 🔧 環境変数管理

### 開発環境での環境変数

#### バックエンド設定 (`.env` ファイル)
```bash
# データベース（Docker使用時）
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fastapi_db

# アプリケーション設定
SECRET_KEY=development-secret-key-change-in-production
DEBUG=true
CORS_ORIGINS=http://localhost:3000

# ログレベル
LOG_LEVEL=DEBUG
```

#### フロントエンド設定 (`.env.local` ファイル)
```bash
# Next.js 設定
NEXT_PUBLIC_API_URL=http://localhost:8000
NODE_ENV=development

# テレメトリ無効化
NEXT_TELEMETRY_DISABLED=1
```

### GitHub Actions での環境変数

**CI/CD実行時に必要な環境変数:**

```yaml
# .github/workflows/backend.yml 内で設定
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
  SECRET_KEY: test-secret-key
  DEBUG: true
```

### 環境変数管理の原則

- **開発環境**: `.env` ファイル（リポジトリにコミットしない）
- **CI/CD環境**: ワークフローファイル内で直接設定
- **本番環境**: プロジェクトの要件に応じて適切な方法で管理
- **設定例**: `.env.example` ファイルで設定項目を明示

---

## 🗄️ 開発環境でのデータベースマイグレーション

### 日常的なマイグレーション操作

#### 基本的なマイグレーション
```bash
cd backend

# 自動マイグレーション（生成＋適用）
task migrate

# マイグレーション生成のみ
task migrate:generate

# 手動でアップグレード
task migrate:upgrade

# 状態確認
task migrate:status
```

#### マイグレーション履歴・管理
```bash
# 履歴表示
task migrate:history

# 安全性チェック
task migrate:check

# 1つ前に巻き戻し（安全性チェック付き）
task migrate:downgrade

# 強制巻き戻し（安全性チェックなし）
task migrate:downgrade:force

# データベース完全リセット（開発環境のみ）
task migrate:reset
```

### マイグレーション安全性機能

**自動安全性チェック**:
- マイグレーションファイルの整合性確認
- 削除されたファイルの検出
- 巻き戻し前のファイル存在確認

**Decision Tree命名システム**:
- 変更内容に基づく自動ファイル命名
- テーブル作成、カラム追加、インデックス操作の自動判別
- 複雑な変更パターンの適切な処理

### CI/CDでのマイグレーション検証

GitHub Actionsでは以下をチェック：
```bash
# マイグレーション安全性チェック
task migrate:check
```

これにより、マイグレーションファイルの整合性問題を早期発見できます。

---

## 🔧 品質チェック・デバッグ

### ローカル開発での品質チェック

#### フロントエンド品質チェック
```bash
cd frontend

# 型チェック
bun run typecheck

# Biome linting・formatting
bun run check
bun run check:fix  # 自動修正

# テスト実行
bun run test

# ビルド確認
bun run build
```

#### バックエンド品質チェック
```bash
cd backend

# 全体的な品質チェック
task check:all

# 個別チェック
task lint         # Ruff linting
task format       # Ruff formatting
task typecheck    # mypy type checking

# 自動修正
task lint:fix     # Ruff自動修正
task fix:all      # lint + format一括修正

# テスト実行
task test
```

### デバッグ・ログ確認

#### アプリケーションログ
```bash
# 開発サーバーでの詳細ログ
cd backend && task dev

# マイグレーションログ
cat backend/src/db/logs/migration_$(date +%Y%m%d).log

# Dockerログ
docker compose -f backend/docker/docker-compose.yml logs
```

#### 品質ツールのデバッグ
```bash
# 詳細な型チェック情報
cd backend && uv run mypy src --verbose

# Ruff詳細情報
uv run ruff check . --verbose

# テストの詳細出力
uv run pytest -v --tb=long
```

### 問題解決時の参照先

**技術的な問題**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) の該当セクションを参照
- CI/CD問題
- 品質ツールエラー
- 環境構築・依存関係問題

**CI/CD固有の問題**: GitHub Actions実行ログとこのドキュメントを併用して解決

---

## 📞 サポート・問題報告

### CI/CD・品質チェック関連の問題

技術的な問題が発生した場合：
1. **ローカル環境**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) を参照
2. **GitHub Actions**: 実行ログの詳細を確認
3. **品質ツール**: 具体的なエラーメッセージを記録

### 問題報告テンプレート

CI/CD・品質関連の問題報告時に含める情報：
- **実行環境**: ローカル / GitHub Actions
- **対象**: フロントエンド / バックエンド
- **コマンド**: 実行したタスク・コマンド
- **エラーログ**: 具体的なエラーメッセージ
- **期待した動作**: 本来の期待結果

---

**最終更新**: 2025年1月  
**対象**: 品質保証・CI/CDに特化したガイド  
**デプロイ**: プロジェクトの要件に応じて別途設定してください