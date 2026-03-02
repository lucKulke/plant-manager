from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WateringEvent(Base):
    __tablename__ = "watering_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.id"), nullable=False)
    pump_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("pumps.id"), nullable=True)
    ts_start: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    duration_s: Mapped[int] = mapped_column(Integer, nullable=False)
    target_l: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason: Mapped[str] = mapped_column(String, nullable=False)  # MANUAL|SCHEDULE|AUTO
    status: Mapped[str] = mapped_column(String, default="PENDING")  # PENDING|OK|FAILED
    cmd_id: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
