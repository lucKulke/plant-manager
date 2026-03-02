from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Plant(Base):
    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    device_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    group_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )

    group: Mapped["app.models.group.Group | None"] = relationship(
        back_populates="plants", foreign_keys=[group_id]
    )
    settings: Mapped["PlantSettings"] = relationship(
        back_populates="plant", uselist=False, cascade="all, delete-orphan"
    )
    schedules: Mapped[list["Schedule"]] = relationship(
        back_populates="plant", cascade="all, delete-orphan"
    )
    moisture_readings: Mapped[list["MoistureReading"]] = relationship(
        back_populates="plant", cascade="all, delete-orphan"
    )


class PlantSettings(Base):
    __tablename__ = "plant_settings"

    plant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plants.id"), primary_key=True
    )
    mode: Mapped[str] = mapped_column(String, default="MANUAL")  # MANUAL|SCHEDULE|AUTO
    auto_threshold_percent: Mapped[float] = mapped_column(Float, default=30.0)
    auto_min_interval_minutes: Mapped[int] = mapped_column(Integer, default=60)
    auto_watering_seconds: Mapped[int] = mapped_column(Integer, default=10)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    plant: Mapped["Plant"] = relationship(back_populates="settings")


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.id"), nullable=False)
    cron_expression: Mapped[str] = mapped_column(String, nullable=False)
    watering_seconds: Mapped[int] = mapped_column(Integer, default=10)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    plant: Mapped["Plant"] = relationship(back_populates="schedules")


class MoistureReading(Base):
    __tablename__ = "moisture_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.id"), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    moisture_percent: Mapped[float] = mapped_column(Float, nullable=False)

    plant: Mapped["Plant"] = relationship(back_populates="moisture_readings")
