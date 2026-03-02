from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    plants: Mapped[list["app.models.plant.Plant"]] = relationship(
        back_populates="group", foreign_keys="Plant.group_id"
    )
    pumps: Mapped[list["app.models.pump.Pump"]] = relationship(
        back_populates="group", foreign_keys="Pump.group_id"
    )
