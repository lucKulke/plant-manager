"""Add firmware_settings table

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa

revision = "b1c2d3e4f5a6"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "firmware_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("wifi_ssid", sa.String(), nullable=False, server_default=""),
        sa.Column("wifi_password", sa.String(), nullable=False, server_default=""),
        sa.Column("mqtt_broker", sa.String(), nullable=False, server_default=""),
        sa.Column("mqtt_port", sa.String(), nullable=False, server_default="1883"),
        sa.Column("ota_password", sa.String(), nullable=False, server_default=""),
    )
    op.execute(
        "INSERT INTO firmware_settings (id, wifi_ssid, wifi_password, mqtt_broker, mqtt_port, ota_password) "
        "VALUES (1, '', '', '', '1883', '')"
    )


def downgrade() -> None:
    op.drop_table("firmware_settings")
