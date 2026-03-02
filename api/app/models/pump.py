from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Pump(Base):
    __tablename__ = "pumps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    device_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    group_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )

    group: Mapped["app.models.group.Group | None"] = relationship(
        back_populates="pumps", foreign_keys=[group_id]
    )
    readings: Mapped[list["PumpReading"]] = relationship(
        back_populates="pump", cascade="all, delete-orphan"
    )


class PumpReading(Base):
    __tablename__ = "pump_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pump_id: Mapped[int] = mapped_column(Integer, ForeignKey("pumps.id"), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    flow_l_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_l: Mapped[float | None] = mapped_column(Float, nullable=True)
    pressure_bar: Mapped[float | None] = mapped_column(Float, nullable=True)

    pump: Mapped["Pump"] = relationship(back_populates="readings")
