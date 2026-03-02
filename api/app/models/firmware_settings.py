from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FirmwareSettings(Base):
    __tablename__ = "firmware_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    wifi_ssid: Mapped[str] = mapped_column(String, nullable=False, default="")
    wifi_password: Mapped[str] = mapped_column(String, nullable=False, default="")
    mqtt_broker: Mapped[str] = mapped_column(String, nullable=False, default="")
    mqtt_port: Mapped[str] = mapped_column(String, nullable=False, default="1883")
    ota_password: Mapped[str] = mapped_column(String, nullable=False, default="")
