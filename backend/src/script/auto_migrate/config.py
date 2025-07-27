# src/script/config.py
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class MigrationConfig:
    """マイグレーション設定クラス"""

    # パス設定
    db_path: Path
    versions_path: Path

    # コマンド設定
    alembic_command: list[str]

    # 正規表現パターン
    patterns: dict[str, str]

    # メッセージ設定
    max_message_length: int
    max_changes_for_detailed_message: int

    @classmethod
    def create_default(cls, project_root: Path | None = None) -> "MigrationConfig":
        """デフォルト設定を作成"""
        if project_root is None:
            # src/script/auto_migrate/config.py -> backend/
            project_root = Path(__file__).parent.parent.parent.parent

        db_path = project_root / "src" / "db"

        return cls(
            # パス設定
            db_path=db_path,
            versions_path=db_path / "migrations" / "versions",
            # コマンド設定（uvを使用）
            alembic_command=["uv", "run", "alembic"],
            # 正規表現パターン
            patterns={
                "create_table": r"op\.create_table\('(\w+)'",
                "drop_table": r"op\.drop_table\('(\w+)'\)",
                "add_column": r"op\.add_column\('(\w+)', sa\.Column\('(\w+)'",
                "drop_column": r"op\.drop_column\('(\w+)', '(\w+)'\)",
                "alter_column": r"op\.alter_column\('(\w+)', '(\w+)'",
                "create_index": r"op\.create_index\(.*?'(\w+)'.*?'(\w+)'",
                "drop_index": r"op\.drop_index\(.*?table_name='(\w+)'",
                "create_foreign_key": r"op\.create_foreign_key\(.*?'(\w+)'.*?'(\w+)'",
                "drop_foreign_key": (
                    r"op\.drop_constraint\('(\w+)', '(\w+)', type_='foreignkey'"
                ),
                "create_constraint": r"op\.create_check_constraint\('(\w+)', '(\w+)'",
                "drop_constraint": r"op\.drop_constraint\('(\w+)', '(\w+)'",
            },
            # メッセージ設定
            max_message_length=50,
            max_changes_for_detailed_message=3,
        )

    def get_env_overrides(self) -> "MigrationConfig":
        """環境変数による設定上書き"""
        config = self

        # 環境変数による上書き
        if db_path_env := os.getenv("MIGRATION_DB_PATH"):
            config.db_path = Path(db_path_env)
            config.versions_path = config.db_path / "migrations" / "versions"

        return config
