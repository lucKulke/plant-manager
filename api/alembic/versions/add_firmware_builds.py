"""Add firmware_builds table

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa

revision = "c2d3e4f5a6b7"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "firmware_builds",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("build_id", sa.String(), nullable=False, unique=True),
        sa.Column("device_type", sa.String(), nullable=False),
        sa.Column("device_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="compiling"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("manifest_url", sa.String(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("firmware_builds")
