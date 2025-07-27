# src/script/test_auto_migrate.py
import tempfile
from collections.abc import Generator
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from .auto_migrate import (
    MigrationAnalyzer,
    MigrationChange,
)
from .config import MigrationConfig


@pytest.fixture
def temp_config() -> Generator[MigrationConfig, None, None]:
    """テスト用の一時的な設定を作成"""
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        db_path = temp_path / "src" / "db"

        config = MigrationConfig(
            db_path=db_path,
            versions_path=db_path / "migrations" / "versions",
            alembic_command=["uv", "run", "alembic"],
            patterns={
                "create_table": r"op\.create_table\('(\w+)'",
                "drop_table": r"op\.drop_table\('(\w+)'\)",
                "add_column": r"op\.add_column\('(\w+)', sa\.Column\('(\w+)'",
                "drop_column": r"op\.drop_column\('(\w+)', '(\w+)'\)",
            },
            max_message_length=50,
            max_changes_for_detailed_message=3,
        )

        # 必要なディレクトリを作成
        config.versions_path.mkdir(parents=True, exist_ok=True)

        yield config


@pytest.fixture
def mock_analyzer(temp_config: MigrationConfig) -> MigrationAnalyzer:
    """モックされたMigrationAnalyzerを作成"""
    with patch("src.script.auto_migrate.MigrationAnalyzer._setup_logger"):
        analyzer = MigrationAnalyzer(temp_config)
        return analyzer


class TestMigrationConfig:
    """MigrationConfig のテストクラス"""

    def test_create_default_config(self) -> None:
        """デフォルト設定が正しく作成されること"""
        config = MigrationConfig.create_default()

        assert config.db_path is not None
        assert config.versions_path is not None
        assert config.alembic_command == ["uv", "run", "alembic"]
        assert config.max_message_length > 0
        assert config.max_changes_for_detailed_message > 0


class TestMigrationAnalyzer:
    """MigrationAnalyzer のテストクラス"""

    def test_analyzer_initialization(self, temp_config: MigrationConfig) -> None:
        """アナライザーが正しく初期化されること"""
        with patch("src.script.auto_migrate.MigrationAnalyzer._setup_logger"):
            analyzer = MigrationAnalyzer(temp_config)

            assert analyzer.config == temp_config
            assert analyzer.config.versions_path.exists()

    def test_slugify_method(self, mock_analyzer: MigrationAnalyzer) -> None:
        """スラグ化が正しく動作すること"""
        test_cases = [
            ("Create user table", "create_user_table"),
            ("Add column to users", "add_column_to_users"),
            ("Remove special!@# characters", "remove_special_characters"),
            (
                "Long message that exceeds the maximum length limit",
                "long_message_that_exceeds_the_maximum_length_l",
            ),
        ]

        for input_text, expected in test_cases:
            actual = mock_analyzer._slugify(input_text)
            assert actual == expected

    def test_analyze_migration_content_create_table(
        self, mock_analyzer: MigrationAnalyzer
    ) -> None:
        """テーブル作成の解析が正しく動作すること"""
        content = """
        def upgrade():
            op.create_table('users',
                sa.Column('id', sa.Integer(), nullable=False),
                sa.Column('name', sa.String(100), nullable=False),
            )
        """

        changes = mock_analyzer._analyze_migration_content(content)

        assert len(changes) == 1
        assert changes[0].change_type == "create_table"
        assert changes[0].table_name == "users"

    def test_analyze_migration_content_add_column(
        self, mock_analyzer: MigrationAnalyzer
    ) -> None:
        """カラム追加の解析が正しく動作すること"""
        content = """
        def upgrade():
            op.add_column('users', sa.Column('email', sa.String(255), nullable=True))
        """

        changes = mock_analyzer._analyze_migration_content(content)

        assert len(changes) == 1
        assert changes[0].change_type == "add_column"
        assert changes[0].table_name == "users"
        assert changes[0].column_name == "email"

    def test_analyze_migration_content_multiple_changes(
        self, mock_analyzer: MigrationAnalyzer
    ) -> None:
        """複数の変更が正しく解析されること"""
        content = """
        def upgrade():
            op.create_table('users',
                sa.Column('id', sa.Integer(), nullable=False),
            )
            op.add_column('posts', sa.Column('author_id', sa.Integer(), nullable=True))
            op.drop_table('old_table')
        """

        changes = mock_analyzer._analyze_migration_content(content)

        assert len(changes) == 3
        change_types = [change.change_type for change in changes]
        assert "create_table" in change_types
        assert "add_column" in change_types
        assert "drop_table" in change_types

    def test_generate_message_from_changes_single(
        self, mock_analyzer: MigrationAnalyzer
    ) -> None:
        """単一変更からのメッセージ生成が正しく動作すること"""
        changes = [MigrationChange(change_type="create_table", table_name="users")]

        message = mock_analyzer._generate_message_from_changes(changes)
        assert message == "Create users table"

    def test_generate_message_from_changes_multiple_detailed(
        self, mock_analyzer: MigrationAnalyzer
    ) -> None:
        """複数変更（詳細表示）からのメッセージ生成が正しく動作すること"""
        changes = [
            MigrationChange(change_type="create_table", table_name="users"),
            MigrationChange(
                change_type="add_column", table_name="posts", column_name="title"
            ),
        ]

        message = mock_analyzer._generate_message_from_changes(changes)
        assert message == "Create users table; Add title to posts"

    def test_generate_message_from_changes_many(
        self, mock_analyzer: MigrationAnalyzer
    ) -> None:
        """多数の変更からのメッセージ生成が正しく動作すること"""
        changes = [
            MigrationChange(change_type="create_table", table_name="users"),
            MigrationChange(change_type="create_table", table_name="posts"),
            MigrationChange(
                change_type="add_column", table_name="comments", column_name="content"
            ),
            MigrationChange(change_type="drop_table", table_name="old_table"),
        ]

        message = mock_analyzer._generate_message_from_changes(changes)
        assert message == "Multiple schema updates (4 changes)"

    def test_generate_message_from_changes_empty(
        self, mock_analyzer: MigrationAnalyzer
    ) -> None:
        """変更がない場合のメッセージ生成が正しく動作すること"""
        changes: list[MigrationChange] = []

        message = mock_analyzer._generate_message_from_changes(changes)
        assert message == "Update schema"


class TestMigrationWorkflow:
    """マイグレーションワークフローのテストクラス"""

    @patch("src.script.auto_migrate.MigrationAnalyzer._run_alembic_command")
    @patch("src.script.auto_migrate.MigrationAnalyzer._get_latest_migration_file")
    @patch("builtins.open")
    def test_migration_generation_success(
        self,
        mock_open: Mock,
        mock_get_file: Mock,
        mock_run_command: Mock,
        mock_analyzer: MigrationAnalyzer,
    ) -> None:
        """マイグレーション生成が正常に動作すること"""
        # モック設定
        mock_run_command.return_value = Mock(returncode=0, stderr="", stdout="")

        temp_file = Path("test_migration.py")
        mock_get_file.return_value = temp_file

        # ファイル読み込みモック
        mock_file_content = """
        def upgrade():
            op.create_table('new_table',
                sa.Column('id', sa.Integer(), nullable=False),
            )
        """
        mock_open.return_value.__enter__.return_value.read.return_value = (
            mock_file_content
        )

        # マイグレーション生成実行
        with patch.object(mock_analyzer, "_update_migration_file") as mock_update:
            result = mock_analyzer.generate_migration_with_auto_message()

        assert result.success is True
        assert "Create new_table table" in result.message
        mock_update.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__])
