from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.mqtt import mqtt_lifespan
from app.routers import auth, groups, health, plants, pumps, schedules, setup, watering


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with mqtt_lifespan():
        yield


app = FastAPI(title="Plant Manager API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(setup.router)
app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(plants.router)
app.include_router(pumps.router)
app.include_router(schedules.router)
app.include_router(watering.router)
