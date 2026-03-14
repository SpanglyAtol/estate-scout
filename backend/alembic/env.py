import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Load all models so Alembic can detect changes
from app.database import Base
import app.models  # noqa: F401 - registers all models on Base.metadata

config = context.config

# Normalize DATABASE_URL for async migrations without writing back via
# Alembic's ConfigParser (which can choke on percent-encoded credentials).
raw_database_url = os.environ.get("DATABASE_URL", "")
normalized_database_url = ""
if raw_database_url:
    url_obj = make_url(raw_database_url)
    if not url_obj.drivername.endswith("+asyncpg") and url_obj.drivername in {"postgresql", "postgres"}:
        url_obj = url_obj.set(drivername="postgresql+asyncpg")
    normalized_database_url = url_obj.render_as_string(hide_password=False)
# Override sqlalchemy.url from environment variable.
# Alembic runs with async_engine_from_config, so normalize plain postgres URLs
# (e.g. postgresql://...) to asyncpg URLs expected by SQLAlchemy async engine.
database_url = os.environ.get("DATABASE_URL", "")
if database_url:
    url_obj = make_url(database_url)
    if not url_obj.drivername.endswith("+asyncpg"):
        if url_obj.drivername in {"postgresql", "postgres"}:
            url_obj = url_obj.set(drivername="postgresql+asyncpg")
    # Alembic uses ConfigParser interpolation; percent-encoded credentials (e.g. %40)
    # must be escaped as %% or set_main_option raises ValueError.
    rendered_url = url_obj.render_as_string(hide_password=False).replace("%", "%%")
    config.set_main_option("sqlalchemy.url", rendered_url)
    config.set_main_option("sqlalchemy.url", url_obj.render_as_string(hide_password=False))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = normalized_database_url or config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connect_args = {}
    if "supabase.co" in raw_database_url:
    raw_db_url = os.environ.get("DATABASE_URL", "")
    if "supabase.co" in raw_db_url:
        # Support both direct Supabase URLs and pooled URLs.
        connect_args["ssl"] = "require"

    engine_url = normalized_database_url or config.get_main_option("sqlalchemy.url")
    connectable = create_async_engine(
        engine_url,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
