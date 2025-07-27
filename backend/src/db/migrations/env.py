import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# add your model's MetaData object here
# for 'autogenerate' support
from src.db.database import Base

# すべてのモデルをインポートしてAlembicが認識できるようにする
from src.db.models.sample import SampleTable  # noqa: F401

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def get_database_url() -> str:
    """環境変数からデータベースURLを取得"""
    # 環境変数から取得（Docker環境用）
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    # 開発環境用デフォルト
    return "postgresql://user:root@localhost:5432/mydb"


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url") or get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # 設定セクションを取得
    configuration = config.get_section(config.config_ini_section, {})

    # データベースURLを環境変数から設定
    if not configuration.get("sqlalchemy.url"):
        configuration["sqlalchemy.url"] = get_database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
