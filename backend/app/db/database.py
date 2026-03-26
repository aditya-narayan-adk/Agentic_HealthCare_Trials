"""
M1: Database Configuration
Owner: Backend Dev 1
Dependencies: None

SQLAlchemy async setup with SQLite (swap to PostgreSQL for production).
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

_connect_args = {"ssl": "require"} if settings.DATABASE_URL.startswith("postgresql") else {}
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, connect_args=_connect_args)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection for FastAPI routes."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Create all tables and apply lightweight column migrations.

    Explicit model import ensures Base.metadata is fully populated
    regardless of which routes happen to be loaded first.
    """
    import app.models.models  # noqa: F401 — registers all ORM classes on Base.metadata

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add content column to advertisement_documents if it was created before
        # this column was added to the model.
        await conn.execute(
            __import__("sqlalchemy").text(
                "ALTER TABLE advertisement_documents "
                "ADD COLUMN IF NOT EXISTS content TEXT;"
            )
        )
        # Add campaign_category and questionnaire columns to advertisements
        # (added for recruitment/survey/hiring/clinical-trial questionnaire feature).
        _sql = __import__("sqlalchemy").text
        await conn.execute(_sql(
            "ALTER TABLE advertisements "
            "ADD COLUMN IF NOT EXISTS campaign_category VARCHAR(64);"
        ))
        await conn.execute(_sql(
            "ALTER TABLE advertisements "
            "ADD COLUMN IF NOT EXISTS questionnaire JSON;"
        ))
        await conn.execute(_sql(
            "ALTER TABLE advertisements "
            "ADD COLUMN IF NOT EXISTS duration VARCHAR(128);"
        ))
