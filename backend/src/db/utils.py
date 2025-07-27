from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import Base

ModelType = TypeVar("ModelType", bound=Base)


async def get_by_id(
    session: AsyncSession, model: type[ModelType], id: int
) -> ModelType | None:
    # model.idではなくmodel.__table__.c.idを使用
    result = await session.execute(select(model).where(model.__table__.c.id == id))
    return result.scalar_one_or_none()


async def create_model(
    session: AsyncSession, model: type[ModelType], **kwargs: object
) -> ModelType:
    db_obj = model(**kwargs)
    session.add(db_obj)
    await session.commit()
    await session.refresh(db_obj)
    return db_obj


async def delete_model(session: AsyncSession, model: type[ModelType], id: int) -> bool:
    db_obj = await get_by_id(session, model, id)
    if db_obj:
        await session.delete(db_obj)
        await session.commit()
        return True
    return False
