"""Add groups table and group_id FK to plants and pumps

Revision ID: a1b2c3d4e5f6
Revises: 9842ecfd91c1
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "9842ecfd91c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )

    with op.batch_alter_table("plants") as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_plants_group_id", "groups", ["group_id"], ["id"], ondelete="SET NULL"
        )

    with op.batch_alter_table("pumps") as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_pumps_group_id", "groups", ["group_id"], ["id"], ondelete="SET NULL"
        )


def downgrade() -> None:
    with op.batch_alter_table("pumps") as batch_op:
        batch_op.drop_constraint("fk_pumps_group_id", type_="foreignkey")
        batch_op.drop_column("group_id")

    with op.batch_alter_table("plants") as batch_op:
        batch_op.drop_constraint("fk_plants_group_id", type_="foreignkey")
        batch_op.drop_column("group_id")

    op.drop_table("groups")
