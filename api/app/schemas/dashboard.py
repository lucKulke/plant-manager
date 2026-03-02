from pydantic import BaseModel


class MoisturePoint(BaseModel):
    ts: str
    plant_name: str
    value: float


class WateringTotal(BaseModel):
    plant_name: str
    total_duration_s: int
    count: int


class PumpFlowPoint(BaseModel):
    ts: str
    pump_name: str
    flow_l_min: float


class DashboardStats(BaseModel):
    total_plants: int
    total_groups: int
    total_pumps: int
    moisture_history: list[MoisturePoint]
    watering_totals: list[WateringTotal]
    pump_flow_history: list[PumpFlowPoint]
