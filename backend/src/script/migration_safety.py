# src/script/migration_safety.py
"""マイグレーション操作の安全性チェックスクリプト"""

import argparse
import re
import subprocess
import sys
from pathlib import Path


def get_current_migration_state() -> str | None:
    """現在のマイグレーション状態を取得"""
    try:
        result = subprocess.run(
            ["uv", "run", "alembic", "current"], capture_output=True, text=True
        )
        if result.returncode == 0:
            # 最初の行からバージョンIDを抽出
            lines = result.stdout.strip().split("\n")
            if lines and lines[0]:
                # バージョンIDは行の最初の部分
                version_match = re.match(r"^([a-f0-9]+)", lines[0])
                if version_match:
                    return version_match.group(1)
        else:
            # エラー詳細を表示
            print(
                f"❌ マイグレーション状態の取得に失敗しました "
                f"(終了コード: {result.returncode})"
            )
            if result.stderr:
                print(f"エラー詳細: {result.stderr.strip()}")
            if result.stdout:
                print(f"出力: {result.stdout.strip()}")
        return None
    except Exception as e:
        print(f"❌ マイグレーション状態の確認でエラーが発生: {e}")
        return None


def get_migration_history() -> list[str]:
    """マイグレーション履歴からバージョンリストを取得"""
    try:
        result = subprocess.run(
            ["uv", "run", "alembic", "history"], capture_output=True, text=True
        )
        versions = []
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                # "version -> version" の形式から抽出
                if " -> " in line:
                    parts = line.split(" -> ")
                    if len(parts) >= 2:
                        # 左側のバージョン（古い方）と右側のバージョン（新しい方）を取得
                        left_version = parts[0].strip()
                        right_part = parts[1].split(" ")[0].strip()
                        # カンマを除去
                        right_version = right_part.rstrip(",")

                        # baseは除外
                        if left_version != "<base>":
                            versions.append(left_version)
                        if right_version != "<base>":
                            versions.append(right_version)

        # 重複を除去して順序を保持
        seen = set()
        unique_versions = []
        for version in versions:
            if version not in seen:
                seen.add(version)
                unique_versions.append(version)

        return unique_versions
    except Exception as e:
        print(f"❌ マイグレーション履歴の確認でエラーが発生: {e}")
        return []


def find_migration_file(version_id: str, versions_path: Path) -> Path | None:
    """指定されたバージョンIDのマイグレーションファイルを探す"""
    for file_path in versions_path.glob("*.py"):
        try:
            with open(file_path, encoding="utf-8") as f:
                content = f.read()
                # revision: str = 'xxxx' の形式を探す
                version_match = re.search(
                    rf"revision:\s*str\s*=\s*['\"]({version_id})['\"]", content
                )
                if version_match:
                    return file_path
        except Exception:
            continue
    return None


def check_migration_files_integrity() -> bool:
    """マイグレーションファイルの整合性をチェック"""
    versions_path = Path("src/db/migrations/versions")

    if not versions_path.exists():
        print("❌ マイグレーションディレクトリが見つかりません")
        return False

    print("🔍 マイグレーションファイルの整合性をチェック中...")

    # 現在のマイグレーション状態を取得
    current_state = get_current_migration_state()
    if not current_state:
        print("❌ 現在のマイグレーション状態を取得できませんでした")
        return False

    print(f"📍 現在のマイグレーション状態: {current_state}")

    # 履歴からすべてのバージョンを取得
    versions = get_migration_history()
    if not versions:
        print("⚠️  マイグレーション履歴が空です")
        return True

    # 現在のバージョンより新しいものをチェック対象から除外
    current_found = False
    versions_to_check = []

    for version in versions:
        if version == current_state:
            current_found = True
        if current_found or version == current_state:
            versions_to_check.append(version)

    print(f"🔎 チェック対象のマイグレーション: {versions_to_check}")

    # 各バージョンのファイル存在をチェック
    missing_files = []
    for version in versions_to_check:
        if version == "<base>":
            continue

        file_path = find_migration_file(version, versions_path)
        if not file_path:
            missing_files.append(version)
            print(f"❌ 見つからないマイグレーションファイル: {version}")
        else:
            print(f"✅ マイグレーションファイル確認: {file_path.name}")

    if missing_files:
        print(f"\n❌ {len(missing_files)}個のマイグレーションファイルが見つかりません:")
        for version in missing_files:
            print(f"   - {version}")
        print("\n⚠️  この状態でマイグレーションの巻き戻し操作を実行すると失敗します。")
        print("   以下の対処方法を検討してください:")
        print("   1. 削除されたマイグレーションファイルを復元する")
        print("   2. データベースを最初からリセットする (task migrate:reset)")
        print("   3. データベースの状態を現在のファイルに合わせて調整する")
        return False

    print("✅ すべてのマイグレーションファイルが正常に存在します")
    return True


def safe_downgrade() -> bool:
    """安全な巻き戻し実行"""
    print("🔄 マイグレーション巻き戻し開始...")

    # 事前チェック
    if not check_migration_files_integrity():
        return False

    # 巻き戻し実行
    try:
        result = subprocess.run(
            ["uv", "run", "alembic", "downgrade", "-1"], capture_output=True, text=True
        )

        if result.returncode == 0:
            print("✅ 巻き戻し完了")
            return True
        else:
            print(f"❌ 巻き戻し失敗: {result.stderr}")
            return False

    except Exception as e:
        print(f"❌ 巻き戻しエラー: {e}")
        return False


def main() -> None:
    """メイン実行関数"""
    parser = argparse.ArgumentParser(description="マイグレーション安全性チェックツール")
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="チェックのみ実行（巻き戻しは行わない）",
    )
    parser.add_argument(
        "--downgrade", action="store_true", help="安全性チェック後に巻き戻しを実行"
    )

    args = parser.parse_args()

    if args.check_only:
        # チェックのみ
        success = check_migration_files_integrity()
        sys.exit(0 if success else 1)
    elif args.downgrade:
        # チェック＋巻き戻し
        success = safe_downgrade()
        sys.exit(0 if success else 1)
    else:
        # デフォルトはチェックのみ
        success = check_migration_files_integrity()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
