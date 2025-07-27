# src/script/auto_migrate/__init__.py
"""Auto Migration Module

データベースマイグレーションの自動化ツール
"""

from .auto_migrate import (
    MigrationAnalyzer,
    MigrationChange,
    MigrationError,
    MigrationResult,
    MigrationStatus,
)
from .config import MigrationConfig

__all__ = [
    "MigrationAnalyzer",
    "MigrationResult",
    "MigrationStatus",
    "MigrationChange",
    "MigrationError",
    "MigrationConfig",
]
