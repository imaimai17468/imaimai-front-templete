**AIエージェント利用時、開発開始プロンプトメモ**
Kiro用
```bash
リポジトリ直下のKIRO_PROMPT.mdを読み込み、記載された初期命令を実行してください。
```
Claude Code用
```bash
リポジトリ直下のREADME.mdとCLAUDE.mdを確認後、担当領域を明確にしてから、該当する専用CLAUDE.mdを読み込んで待機して
```

# Next.js + FastAPI Template

モダンなフルスタックWebアプリケーション開発のためのテンプレートリポジトリです。Next.js 15とFastAPIを組み合わせ、型安全性と開発効率を重視した構成になっています。

## 🚀 概要

このテンプレートは、以下の特徴を持つフルスタックアプリケーションの迅速な開発を支援します：

- **型安全性**: TypeScript（フロントエンド）とPython型ヒント（バックエンド）による完全な型安全性
- **モダンな技術スタック**: 最新のフレームワークとツールを採用
- **開発効率**: 自動化されたマイグレーション、リンティング、フォーマット
- **プロダクション対応**: Docker、CI/CD対応の本格的な構成

## 📁 プロジェクト構成

```
nextjs-fastapi-template/
├── frontend/                   # Next.js フロントエンド
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   ├── components/        # Reactコンポーネント
│   │   └── lib/               # ユーティリティ
│   ├── package.json
│   └── README.md              # フロントエンド詳細ドキュメント
├── backend/                    # FastAPI バックエンド
│   ├── src/
│   │   ├── main.py           # FastAPIアプリケーション
│   │   ├── db/               # データベース関連
│   │   └── script/           # ユーティリティスクリプト
│   ├── pyproject.toml
│   └── README.md              # バックエンド詳細ドキュメント
└── README.md                   # このファイル
```

## 🛠️ 技術スタック

### フロントエンド
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Code Quality**: Biome (linting & formatting)
- **Testing**: Vitest + Testing Library
- **Package Manager**: Bun

### バックエンド
- **Framework**: FastAPI
- **Language**: Python 3.11
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy 2.0+
- **Migration**: Alembic + 自動マイグレーションツール
- **Code Quality**: Ruff (linting & formatting) + mypy (type checking)
- **Package Manager**: uv
- **Task Runner**: Task

### 開発環境・インフラ
- **Version Management**: mise
- **Containerization**: Docker + Docker Compose
- **Git Hooks**: Lefthook (frontend) + 品質チェック自動化

## ⚡ クイックスタート

### 前提条件
- Node.js 18.0.0 以上
- Python 3.11 以上
- Docker & Docker Compose
- mise (推奨)

### 1. リポジトリのクローン
```bash
git clone https://github.com/Hol1kgmg/nextjs-fastAPI-templete.git
cd nextjs-fastAPI-templete
```

### 2. フロントエンド環境構築
```bash
cd frontend
bun install
bun run dev
```
詳細は [`frontend/README.md`](./frontend/README.md) を参照

### 3. バックエンド環境構築

**重要**: バックエンドの環境構築は複数のステップと環境設定が必要なため、AIではなく**開発者自身が手動で実行**することを強く推奨します。

```bash
cd backend
# 詳細な環境構築手順は backend/README.md を必ず確認してください
```

**注意事項**:
- `mise install` や `task install` 実行直後は、コマンドが適切に使用できない場合があります
- `task docker:up` の前に `task docker:build` が必要な場合があります
- 環境によってはターミナルの再起動やシェル設定の更新が必要です

詳細な手順と注意点は [`backend/README.md`](./backend/README.md) を参照し、段階的に環境構築を進めてください。

## 🔧 問題が発生した場合

初回環境構築や開発中に問題が発生した場合は、**[📋 TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** を参照してください。

**よくある問題**:
- Docker関連のポート競合・権限エラー
- パッケージインストール失敗
- マイグレーション・データベース接続問題
- コード品質ツールエラー

各問題の詳細な解決方法と環境固有の対処法を網羅しています。

問題が解決しない場合は、環境情報と共にGitHubでイシューを作成してください。

## 🌟 主な機能

### フロントエンド
- **モダンなReact開発**: App Router、Server Components対応
- **コンポーネント駆動開発**: Storybook統合
- **厳格なコード品質**: Biome + Lefthook による自動品質管理
- **型安全なUI**: shadcn/ui + TypeScript

### バックエンド
- **高性能API**: FastAPI + 非同期処理
- **インテリジェントマイグレーション**: Decision Tree による自動ファイル命名
- **包括的な型チェック**: mypy strict mode
- **開発効率化**: 自動マイグレーション、ホットリロード

### 開発体験
- **統一された開発環境**: mise による一貫したツール管理
- **自動化されたワークフロー**: Git hooks、品質チェック
- **包括的なドキュメント**: 各コンポーネントの詳細ガイド

## 📚 ドキュメント

各コンポーネントの詳細な情報は、それぞれのREADME.mdを参照してください：

- **[フロントエンド詳細](./frontend/README.md)**: Next.js環境構築、開発方法、コンポーネント設計
- **[バックエンド詳細](./backend/README.md)**: FastAPI環境構築、データベース設計、API開発
- **[自動マイグレーションツール](./backend/src/script/auto_migrate/README.md)**: 高度なマイグレーション機能の詳細

## 🤝 開発ガイドライン

このテンプレートは、以下の開発原則に基づいて設計されています：

- **型安全性の徹底**: フロントエンドからバックエンドまで一貫した型安全性
- **コード品質の自動化**: 手動チェックに依存しない品質管理
- **開発効率の最大化**: 繰り返し作業の自動化と最適化
- **プロダクション対応**: 本格的な運用に耐える構成

## 📄 ライセンス

このテンプレートはMITライセンスの下で公開されています。

## 🚀 次のステップ

1. 各コンポーネントのREADME.mdで詳細な環境構築を実行
2. サンプルコードを参考に、独自の機能を実装
3. 必要に応じて技術スタックをカスタマイズ

---

**Happy Coding! 🎉**