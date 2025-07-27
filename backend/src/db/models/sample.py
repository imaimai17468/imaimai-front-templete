from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.db.models.base import BaseModel


class SampleTable(BaseModel):
    __tablename__ = "sample_table"

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<SampleTable(id={self.id}, name='{self.name}', "
            f"is_active={self.is_active})>"
        )
