from fastapi import APIRouter
from app.api.v1.endpoints import (
    loads, entities, payroll, reports, auth,
    drivers_export,   # must be before driver_docs — avoids /{driver_id} swallowing /export/*
    driver_docs,
    drivers_extended,
    vendors,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(loads.router)
api_router.include_router(entities.router)
api_router.include_router(payroll.router)
api_router.include_router(reports.router)
api_router.include_router(auth.router)
api_router.include_router(drivers_export.router)   # before driver_docs
api_router.include_router(driver_docs.router)
api_router.include_router(drivers_extended.router)
api_router.include_router(vendors.router)
