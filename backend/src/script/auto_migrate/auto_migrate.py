# src/script/auto_migrate.py
import argparse
import logging
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

from .config import MigrationConfig

"""
Decision Tree:
単一変更 → {action}_{name}_{target}
同一テーブル複数同種 → {action}_{count}{target}_{table}_table
同一テーブル複数異種 → change_{count}items_{table}_table
複数テーブル同種 → {action}_{target}_{count}tables
複数テーブル異種 → change_mixed_actions
"""


# 型定義
TableChangesDict = dict[str, list["MigrationChange"]]
ActionChangesDict = dict[str, list["MigrationChange"]]


# 定数定義
class FilenamingConstants:
    """ファイル名生成用の定数"""

    # Decision Tree パターン
    MIXED_ACTIONS_FILENAME = "change_mixed_actions"
    MULTIPLE_ITEMS_PREFIX = "change"
    ITEMS_SUFFIX = "items"
    TABLE_SUFFIX = "table"
    TABLES_SUFFIX = "tables"

    # アクション優先度 (高い数値 = 高優先度)
    ACTION_PRIORITY = {
        "create": 4,
        "add": 3,
        "modify": 2,
        "delete": 1,
    }

    # テーブル作成・削除系アクション
    TABLE_ACTIONS = {"create", "delete"}

    # カラム関連のアクション
    COLUMN_ACTIONS = {"add_column", "drop_column", "alter_column"}


# メッセージ定数
class Messages:
    UP_TO_DATE = "データベースは既に最新の状態です"
    PENDING_MIGRATIONS = (
        "未適用のマイグレーションが存在します。先にアップグレードを実行します。"
    )
    UPGRADE_SUCCESS = "データベースアップグレード成功"
    MIGRATION_SUCCESS = "マイグレーション作成成功"
    STATUS_DISPLAY_SUCCESS = "マイグレーション状態表示完了"


class MigrationStatus(Enum):
    """マイグレーション実行状態"""

    SUCCESS = "success"
    ERROR = "error"
    NO_CHANGES = "no_changes"
    PENDING_MIGRATIONS = "pending_migrations"


@dataclass
class MigrationChange:
    """マイグレーション変更内容を表すクラス"""

    change_type: str
    table_name: str
    detail: str = ""
    column_name: str = ""
    constraint_name: str = ""


@dataclass
class MigrationResult:
    """マイグレーション実行結果を表すクラス"""

    success: bool
    message: str
    status: MigrationStatus
    file_path: Path | None = None
    changes: list[MigrationChange] | None = None

    @classmethod
    def success_result(
        cls,
        message: str,
        status: MigrationStatus = MigrationStatus.SUCCESS,
        file_path: Path | None = None,
        changes: list[MigrationChange] | None = None,
    ) -> "MigrationResult":
        return cls(True, message, status, file_path, changes)

    @classmethod
    def error_result(cls, message: str) -> "MigrationResult":
        return cls(False, message, MigrationStatus.ERROR)


class MigrationError(Exception):
    """マイグレーション専用例外クラス"""

    pass


class MigrationAnalyzer:
    """マイグレーション内容を解析してメッセージを自動生成"""

    def __init__(self, config: MigrationConfig | None = None):
        self.config = config or MigrationConfig.create_default().get_env_overrides()
        self.logger = self._setup_logger()

        # ディレクトリの作成
        self._ensure_directories()

    def _setup_logger(self) -> logging.Logger:
        """ロガーのセットアップ"""
        logger = logging.getLogger("migration_analyzer")
        logger.setLevel(logging.INFO)

        # ハンドラーが既に存在する場合は削除
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)

        # コンソールハンドラー
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)

        # ファイルハンドラー（ログファイル）
        log_dir = self.config.db_path / "logs"
        log_dir.mkdir(exist_ok=True)
        file_handler = logging.FileHandler(
            log_dir / f"migration_{datetime.now().strftime('%Y%m%d')}.log",
            encoding="utf-8",
        )
        file_handler.setLevel(logging.DEBUG)

        # フォーマッター
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        console_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)

        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

        return logger

    def _ensure_directories(self) -> None:
        """必要なディレクトリを作成"""
        directories = [self.config.versions_path, self.config.db_path / "logs"]

        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            self.logger.debug(f"ディレクトリ確認/作成: {directory}")

    def _check_pending_migrations(self) -> MigrationResult | None:
        """未適用のマイグレーションがあるかチェック"""
        try:
            # 現在の状態を取得
            current_result = self._run_alembic_command(["current"])
            if current_result.returncode != 0:
                return None

            current_revision = current_result.stdout.strip().split("\n")[0]

            # 最新の状態を取得
            heads_result = self._run_alembic_command(["heads"])
            if heads_result.returncode != 0:
                return None

            head_revision = heads_result.stdout.strip().split("\n")[0]

            # 現在の状態と最新が異なる場合、未適用のマイグレーションがある
            if current_revision != head_revision:
                self.logger.info("📋 未適用のマイグレーションが検出されました")
                return MigrationResult.success_result(
                    Messages.PENDING_MIGRATIONS, MigrationStatus.PENDING_MIGRATIONS
                )

            return None

        except Exception as e:
            self.logger.debug(f"未適用マイグレーションチェック中にエラー: {e}")
            return None

    def generate_migration_with_auto_message(self) -> MigrationResult:
        """自動メッセージ付きでマイグレーションを生成"""
        try:
            self.logger.info("🔄 マイグレーション生成開始...")

            # まず、未適用のマイグレーションがあるかチェック
            pending_check = self._check_pending_migrations()
            if pending_check:
                return pending_check

            # 次の番号を事前に取得
            next_number = self._get_next_number()

            # 一時的にマイグレーション生成
            temp_message = f"temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            result = self._run_alembic_command(
                ["revision", "--autogenerate", "-m", temp_message]
            )

            if result.returncode != 0:
                error_msg = (
                    f"マイグレーション生成に失敗: stdout='{result.stdout}', "
                    f"stderr='{result.stderr}', returncode={result.returncode}"
                )
                self.logger.error(error_msg)
                raise MigrationError(error_msg)

            # 最新のマイグレーションファイルを取得
            latest_file = self._get_latest_migration_file()
            if not latest_file:
                error_msg = "マイグレーションファイルが見つかりません"
                self.logger.error(error_msg)
                raise MigrationError(error_msg)

            # ファイル内容を解析してメッセージ生成
            with open(latest_file, encoding="utf-8") as f:
                content = f.read()

            changes = self._analyze_migration_content(content)
            if not changes:
                self.logger.info(f"✅ {Messages.UP_TO_DATE}")
                os.remove(latest_file)
                return MigrationResult.success_result(
                    Messages.UP_TO_DATE, MigrationStatus.NO_CHANGES
                )

            message = self._generate_message_from_changes(changes)
            new_file_path = self._update_migration_file(
                latest_file, temp_message, message, changes, next_number
            )

            self.logger.info(f"✅ {Messages.MIGRATION_SUCCESS}: {message}")
            return MigrationResult.success_result(
                message, MigrationStatus.SUCCESS, new_file_path, changes
            )

        except Exception as e:
            error_msg = f"エラーが発生しました: {e}"
            self.logger.error(error_msg, exc_info=True)
            return MigrationResult.error_result(error_msg)

    def _run_alembic_command(self, args: list[str]) -> subprocess.CompletedProcess[str]:
        """Alembicコマンドを実行"""
        command = self.config.alembic_command + args

        # alembic.iniがあるプロジェクトルートで実行
        project_root = (
            self.config.db_path.parent.parent
        )  # src/db -> src -> プロジェクトルート

        self.logger.debug(f"実行コマンド: {' '.join(command)}")
        self.logger.debug(f"実行ディレクトリ: {project_root}")

        return subprocess.run(command, cwd=project_root, capture_output=True, text=True)

    def _get_next_number(self) -> str:
        """次のマイグレーション番号を生成"""
        if not self.config.versions_path.exists():
            return "0001"

        migration_files = list(self.config.versions_path.glob("*.py"))
        if not migration_files:
            return "0001"

        # 既存ファイル名から番号を抽出
        numbers = []
        for file in migration_files:
            filename = file.name
            # 4桁の数字で始まるファイル名のみ対象（ただし4桁きっちりのもののみ）
            if len(filename) >= 4 and filename[:4].isdigit() and filename[4] == "_":
                number = int(filename[:4])
                # 正常な範囲内の番号のみを対象（0001-9999）
                if 1 <= number <= 9999:
                    numbers.append(number)

        if not numbers:
            return "0001"

        next_number = max(numbers) + 1
        return f"{next_number:04d}"

    def _get_latest_migration_file(self) -> Path | None:
        """最新のマイグレーションファイルを取得"""
        if not self.config.versions_path.exists():
            return None

        migration_files = list(self.config.versions_path.glob("*.py"))
        if not migration_files:
            return None

        return max(migration_files, key=os.path.getctime)

    def _analyze_migration_content(self, content: str) -> list[MigrationChange]:
        """マイグレーション内容から変更を抽出"""
        upgrade_content = self._extract_upgrade_content(content)
        if not upgrade_content:
            return []

        changes: list[MigrationChange] = []
        for change_type, pattern in self.config.patterns.items():
            matches = re.findall(pattern, upgrade_content)
            for match in matches:
                change = self._create_migration_change(change_type, match)
                if change:
                    changes.append(change)

        return changes

    def _extract_upgrade_content(self, content: str) -> str | None:
        """upgrade関数の部分のみを抽出"""
        upgrade_match = re.search(
            r"def upgrade\(\).*?:.*?(?=def downgrade\(\)|$)", content, re.DOTALL
        )
        return upgrade_match.group(0) if upgrade_match else None

    def _create_migration_change(
        self, change_type: str, match: Any
    ) -> MigrationChange | None:
        """マッチ結果からMigrationChangeオブジェクトを作成"""
        if change_type in ["create_table", "drop_table"]:
            return self._create_table_change(change_type, match)
        elif change_type in ["add_column", "drop_column", "alter_column"]:
            return self._create_column_change(change_type, match)
        elif change_type in ["create_index", "drop_index"]:
            return self._create_index_change(change_type, match)
        elif change_type in [
            "create_foreign_key",
            "drop_foreign_key",
            "create_constraint",
            "drop_constraint",
        ]:
            return self._create_constraint_change(change_type, match)
        return None

    def _create_table_change(self, change_type: str, match: Any) -> MigrationChange:
        """テーブル変更のMigrationChangeを作成"""
        table_name = match
        return MigrationChange(change_type=change_type, table_name=table_name)

    def _create_column_change(
        self, change_type: str, match: Any
    ) -> MigrationChange | None:
        """カラム変更のMigrationChangeを作成"""
        if isinstance(match, tuple) and len(match) >= 2:
            table_name, column_name = match[0], match[1]
            return MigrationChange(
                change_type=change_type,
                table_name=table_name,
                column_name=column_name,
            )
        return None

    def _create_index_change(
        self, change_type: str, match: Any
    ) -> MigrationChange | None:
        """インデックス変更のMigrationChangeを作成"""
        if isinstance(match, tuple):
            if change_type == "create_index" and len(match) >= 2:
                table_name = match[1]
                index_name = match[0]
            else:
                table_name = match[0]
                index_name = ""

            return MigrationChange(
                change_type=change_type,
                table_name=table_name,
                detail=f"index: {index_name}" if index_name else "",
            )
        return None

    def _create_constraint_change(
        self, change_type: str, match: Any
    ) -> MigrationChange | None:
        """制約変更のMigrationChangeを作成"""
        if isinstance(match, tuple) and len(match) >= 2:
            constraint_name, table_name = match[0], match[1]
            return MigrationChange(
                change_type=change_type,
                table_name=table_name,
                constraint_name=constraint_name,
            )
        return None

    def _generate_message_from_changes(self, changes: list[MigrationChange]) -> str:
        """変更リストから読みやすいメッセージを生成"""
        if not changes:
            return "Update schema"

        messages = [self._generate_single_change_message(change) for change in changes]
        return self._format_messages(messages)

    def _generate_single_change_message(self, change: MigrationChange) -> str:
        """単一の変更からメッセージを生成"""
        message_map = {
            "create_table": f"Create {change.table_name} table",
            "drop_table": f"Drop {change.table_name} table",
            "add_column": f"Add {change.column_name} to {change.table_name}",
            "drop_column": f"Remove {change.column_name} from {change.table_name}",
            "alter_column": f"Modify {change.column_name} in {change.table_name}",
            "create_index": f"Add index to {change.table_name}",
            "drop_index": f"Remove index from {change.table_name}",
            "create_foreign_key": f"Add foreign key to {change.table_name}",
            "drop_foreign_key": f"Remove foreign key from {change.table_name}",
            "create_constraint": f"Add constraint to {change.table_name}",
            "drop_constraint": f"Remove constraint from {change.table_name}",
        }
        return message_map.get(
            change.change_type, f"Unknown change to {change.table_name}"
        )

    def _format_messages(self, messages: list[str]) -> str:
        """メッセージリストを適切な形式に整形"""
        if len(messages) == 1:
            return messages[0]
        elif len(messages) <= self.config.max_changes_for_detailed_message:
            return "; ".join(messages)
        else:
            return f"Multiple schema updates ({len(messages)} changes)"

    def _generate_filename_from_changes(self, changes: list[MigrationChange]) -> str:
        """変更リストからファイル名を生成（Decision Tree based）"""
        if not changes:
            return "update_schema"

        # テーブル別グループ化
        by_table: TableChangesDict = {}
        for change in changes:
            table = change.table_name
            if table not in by_table:
                by_table[table] = []
            by_table[table].append(change)

        # アクション別グループ化
        by_action: ActionChangesDict = {}
        for change in changes:
            action = self._normalize_action(change.change_type)
            if action not in by_action:
                by_action[action] = []
            by_action[action].append(change)

        # 判定フラグ
        is_single_table = len(by_table) == 1
        is_single_action = len(by_action) == 1

        # Decision Tree実装
        if len(changes) == 1:
            # 単一変更: create_users_table
            change = changes[0]
            action = self._normalize_action(change.change_type)
            name = self._get_target_name(change)
            target = self._get_target_type(change.change_type)
            return f"{action}_{name}_{target}"
        elif is_single_table and is_single_action:
            # 同一テーブル複数同種: add_3columns_users_table
            return self._generate_single_table_single_action_filename(
                by_table, by_action, changes
            )
        elif is_single_table:
            # 同一テーブル複数異種: change_2items_users_table
            table_name = self._get_single_key(by_table)
            count = len(changes)
            return (
                f"{FilenamingConstants.MULTIPLE_ITEMS_PREFIX}_{count}"
                f"{FilenamingConstants.ITEMS_SUFFIX}_{table_name}_"
                f"{FilenamingConstants.TABLE_SUFFIX}"
            )
        elif is_single_action:
            # 複数テーブル同種: create_2tables
            return self._generate_multi_table_single_action_filename(
                by_action, by_table
            )
        else:
            # 複数テーブル異種: change_mixed_actions
            return FilenamingConstants.MIXED_ACTIONS_FILENAME

    def _normalize_action(self, change_type: str) -> str:
        """アクションの正規化"""
        action_map = {
            "create_table": "create",
            "drop_table": "delete",
            "add_column": "add",
            "drop_column": "delete",
            "alter_column": "modify",
            "create_index": "add",
            "drop_index": "delete",
            "create_foreign_key": "add",
            "drop_foreign_key": "delete",
            "create_constraint": "add",
            "drop_constraint": "delete",
        }
        return action_map.get(change_type, "change")

    def _get_primary_action(self, by_action: ActionChangesDict) -> str:
        """複数アクションから優先度に基づいて主要アクションを決定"""
        # 優先度の高いアクションを取得
        primary_action = max(
            by_action.keys(),
            key=lambda action: FilenamingConstants.ACTION_PRIORITY.get(action, 0),
        )
        return primary_action

    def _get_single_key(self, dictionary: dict[str, list[MigrationChange]]) -> str:
        """辞書から単一キーを型安全に取得"""
        keys = list(dictionary.keys())
        if not keys:
            raise ValueError("辞書が空です")
        return keys[0]

    def _get_single_value_list(
        self, dictionary: dict[str, list[MigrationChange]]
    ) -> list[MigrationChange]:
        """辞書から単一の値リストを型安全に取得"""
        values = list(dictionary.values())
        if not values:
            raise ValueError("辞書が空です")
        return values[0]

    def _get_target_name(self, change: MigrationChange) -> str:
        """対象名を取得"""
        if change.change_type in ["create_table", "drop_table"]:
            return change.table_name
        elif change.change_type in ["add_column", "drop_column", "alter_column"]:
            return change.column_name
        else:
            return change.table_name

    def _get_target_type(self, change_type: str) -> str:
        """対象タイプを取得"""
        if "table" in change_type:
            return "table"
        elif "column" in change_type:
            return "column"
        elif "index" in change_type:
            return "index"
        elif "foreign_key" in change_type:
            return "foreign_key"
        elif "constraint" in change_type:
            return "constraint"
        else:
            return "item"

    def _get_target_type_plural(self, change_type: str) -> str:
        """対象タイプの複数形を取得"""
        if "table" in change_type:
            return "tables"
        elif "column" in change_type:
            return "columns"
        elif "index" in change_type:
            return "indexes"
        elif "foreign_key" in change_type:
            return "foreign_keys"
        elif "constraint" in change_type:
            return "constraints"
        else:
            return "items"

    def _generate_single_table_single_action_filename(
        self,
        by_table: TableChangesDict,
        by_action: ActionChangesDict,
        changes: list[MigrationChange],
    ) -> str:
        """同一テーブル複数同種変更のファイル名を生成"""
        table_name = self._get_single_key(by_table)
        action = self._get_single_key(by_action)
        count = len(changes)

        # 最初の変更からターゲット型を取得
        first_change = self._get_single_value_list(by_action)[0]
        target = self._get_target_type_plural(first_change.change_type)

        return (
            f"{action}_{count}{target}_{table_name}_{FilenamingConstants.TABLE_SUFFIX}"
        )

    def _generate_multi_table_single_action_filename(
        self, by_action: ActionChangesDict, by_table: TableChangesDict
    ) -> str:
        """複数テーブル同種変更のファイル名を生成"""
        action = self._get_single_key(by_action)
        table_count = len(by_table)

        # アクションに基づいて適切なターゲット名を決定
        if action in FilenamingConstants.TABLE_ACTIONS:
            # テーブル作成/削除の場合: create_2tables
            return f"{action}_{table_count}{FilenamingConstants.TABLES_SUFFIX}"
        elif action == "add":
            # カラム追加などの場合、具体的な対象を確認
            first_change = self._get_single_value_list(by_action)[0]
            if first_change.change_type in FilenamingConstants.COLUMN_ACTIONS:
                return f"add_{table_count}columns"
            else:
                return f"{action}_{table_count}{FilenamingConstants.ITEMS_SUFFIX}"
        else:
            # その他の変更: modify_2tables
            return f"{action}_{table_count}{FilenamingConstants.TABLES_SUFFIX}"

    def _update_migration_file(
        self,
        file_path: Path,
        temp_message: str,
        new_message: str,
        changes: list[MigrationChange],
        number: str,
    ) -> Path:
        """マイグレーションファイルのメッセージとファイル名を更新"""
        # ファイル内容のメッセージ更新
        with open(file_path, encoding="utf-8") as f:
            content = f.read()

        content = content.replace(f'"""{temp_message}', f'"""{new_message}')

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        # ファイル名更新（新しい命名システムを使用）
        filename_from_changes = self._generate_filename_from_changes(changes)
        new_filename = f"{number}_{filename_from_changes}.py"
        new_path = file_path.parent / new_filename
        file_path.rename(new_path)

        self.logger.debug(f"ファイル名更新: {file_path.name} -> {new_filename}")
        return new_path

    def _slugify(self, text: str) -> str:
        """テキストをファイル名用にスラグ化"""
        # 英数字とスペース以外を削除
        text = re.sub(r"[^\w\s-]", "", text)
        # スペースをアンダースコアに変換
        text = re.sub(r"[\s_-]+", "_", text)
        # 小文字化
        text = text.lower().strip("_")
        # 長すぎる場合は切り詰め
        if len(text) > self.config.max_message_length:
            text = text[: self.config.max_message_length].rstrip("_")
        return text

    def upgrade_database(self) -> MigrationResult:
        """データベースをアップグレード"""
        try:
            self.logger.info("🔄 データベースアップグレード開始...")

            result = self._run_alembic_command(["upgrade", "head"])
            if result.returncode == 0:
                self.logger.info(f"✅ {Messages.UPGRADE_SUCCESS}")
                return MigrationResult.success_result(Messages.UPGRADE_SUCCESS)
            else:
                error_msg = f"データベースアップグレード失敗: {result.stderr}"
                self.logger.error(error_msg)
                return MigrationResult.error_result(error_msg)

        except Exception as e:
            error_msg = f"アップグレードエラー: {e}"
            self.logger.error(error_msg, exc_info=True)
            return MigrationResult.error_result(error_msg)

    def show_migration_status(self) -> MigrationResult:
        """マイグレーション状態を表示"""
        try:
            result = self._run_alembic_command(["current"])
            if result.returncode == 0:
                current_info = result.stdout.strip()
                self.logger.info(f"📊 現在のマイグレーション状態:\n{current_info}")

                # 保留中のマイグレーションも確認
                heads_result = self._run_alembic_command(["heads"])
                if heads_result.returncode == 0:
                    heads_info = heads_result.stdout.strip()
                    self.logger.info(f"📈 利用可能なマイグレーション:\n{heads_info}")

                return MigrationResult.success_result(Messages.STATUS_DISPLAY_SUCCESS)
            else:
                error_msg = f"状態確認失敗: {result.stderr}"
                self.logger.error(error_msg)
                return MigrationResult.error_result(error_msg)

        except Exception as e:
            error_msg = f"状態確認エラー: {e}"
            self.logger.error(error_msg, exc_info=True)
            return MigrationResult.error_result(error_msg)


def main() -> None:
    """メイン実行関数"""
    args = _parse_arguments()
    config = MigrationConfig.create_default().get_env_overrides()
    analyzer = MigrationAnalyzer(config)

    try:
        if args.status:
            _handle_status_command(analyzer)
            return

        _execute_migration_workflow(analyzer, args.no_upgrade)

    except KeyboardInterrupt:
        print("\n⚠️  操作がキャンセルされました")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 予期しないエラーが発生: {e}")
        sys.exit(1)


def _parse_arguments() -> argparse.Namespace:
    """コマンドライン引数を解析"""
    parser = argparse.ArgumentParser(description="自動マイグレーションツール")
    parser.add_argument(
        "--no-upgrade",
        action="store_true",
        help="マイグレーション生成のみ（データベースアップグレードを行わない）",
    )
    parser.add_argument(
        "--status", action="store_true", help="マイグレーション状態のみを表示"
    )
    return parser.parse_args()


def _handle_status_command(analyzer: MigrationAnalyzer) -> None:
    """状態表示コマンドを処理"""
    result = analyzer.show_migration_status()
    sys.exit(0 if result.success else 1)


def _execute_migration_workflow(analyzer: MigrationAnalyzer, no_upgrade: bool) -> None:
    """マイグレーションワークフローを実行"""
    print("🔄 自動マイグレーション開始...")

    # マイグレーション生成
    migration_result = analyzer.generate_migration_with_auto_message()

    if not migration_result.success:
        print(f"❌ マイグレーション生成に失敗: {migration_result.message}")
        sys.exit(1)

    # 結果に応じた処理
    _handle_migration_result(analyzer, migration_result, no_upgrade)


def _handle_migration_result(
    analyzer: MigrationAnalyzer, migration_result: MigrationResult, no_upgrade: bool
) -> None:
    """マイグレーション結果に応じた処理"""
    # 変更がない場合
    if migration_result.status == MigrationStatus.NO_CHANGES:
        print(f"✅ {migration_result.message}")
        sys.exit(0)

    # 未適用のマイグレーションがある場合
    if migration_result.status == MigrationStatus.PENDING_MIGRATIONS:
        _handle_pending_migrations(analyzer, migration_result, no_upgrade)
        return

    # 新しいマイグレーションが生成された場合
    _handle_new_migration(analyzer, migration_result, no_upgrade)


def _handle_pending_migrations(
    analyzer: MigrationAnalyzer, migration_result: MigrationResult, no_upgrade: bool
) -> None:
    """未適用マイグレーションの処理"""
    print(f"📋 {migration_result.message}")
    if not no_upgrade:
        upgrade_result = analyzer.upgrade_database()
        if upgrade_result.success:
            print("🎉 未適用のマイグレーション適用完了!")
        else:
            print(f"❌ アップグレードに失敗: {upgrade_result.message}")
            sys.exit(1)
    else:
        print("ℹ️  --no-upgradeが指定されているため、アップグレードをスキップしました")


def _handle_new_migration(
    analyzer: MigrationAnalyzer, migration_result: MigrationResult, no_upgrade: bool
) -> None:
    """新規マイグレーションの処理"""
    print(f"✅ マイグレーション生成完了: {migration_result.message}")
    print(f"📄 ファイルパス: {migration_result.file_path}")

    if not no_upgrade:
        upgrade_result = analyzer.upgrade_database()
        if upgrade_result.success:
            print("🎉 マイグレーション完了!")
        else:
            print(f"❌ データベースアップグレードに失敗: {upgrade_result.message}")
            sys.exit(1)
    else:
        print("ℹ️  データベースアップグレードはスキップされました")
        print(
            "💡 手動でマイグレーションファイルを確認してから "
            "`task alembic upgrade head` を実行してください"
        )


if __name__ == "__main__":
    main()
