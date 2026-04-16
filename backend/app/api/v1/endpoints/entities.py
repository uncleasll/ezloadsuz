from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.schemas.schemas import (
    DriverCreate, DriverUpdate, DriverOut,
    TruckCreate, TruckUpdate, TruckOut,
    TrailerCreate, TrailerUpdate, TrailerOut,
    BrokerCreate, BrokerUpdate, BrokerOut,
    DispatcherCreate, DispatcherUpdate, DispatcherOut
)
from app.crud import entities as crud

router = APIRouter(tags=["entities"])


# ─── Drivers ──────────────────────────────────────────────────────────────────

@router.get("/drivers", response_model=List[DriverOut])
def list_drivers(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    return crud.get_drivers(db, is_active)


@router.post("/drivers", response_model=DriverOut, status_code=201)
def create_driver(driver_in: DriverCreate, db: Session = Depends(get_db)):
    return crud.create_driver(db, driver_in)


@router.put("/drivers/{driver_id}", response_model=DriverOut)
def update_driver(driver_id: int, driver_in: DriverUpdate, db: Session = Depends(get_db)):
    driver = crud.update_driver(db, driver_id, driver_in)
    if not driver:
        raise HTTPException(404, "Driver not found")
    return driver


# ─── Trucks ───────────────────────────────────────────────────────────────────

@router.get("/trucks", response_model=List[TruckOut])
def list_trucks(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    return crud.get_trucks(db, is_active)


@router.post("/trucks", response_model=TruckOut, status_code=201)
def create_truck(truck_in: TruckCreate, db: Session = Depends(get_db)):
    return crud.create_truck(db, truck_in)


@router.put("/trucks/{truck_id}", response_model=TruckOut)
def update_truck(truck_id: int, truck_in: TruckUpdate, db: Session = Depends(get_db)):
    truck = crud.update_truck(db, truck_id, truck_in)
    if not truck:
        raise HTTPException(404, "Truck not found")
    return truck


# ─── Trailers ─────────────────────────────────────────────────────────────────

@router.get("/trailers", response_model=List[TrailerOut])
def list_trailers(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    return crud.get_trailers(db, is_active)


@router.post("/trailers", response_model=TrailerOut, status_code=201)
def create_trailer(trailer_in: TrailerCreate, db: Session = Depends(get_db)):
    return crud.create_trailer(db, trailer_in)


@router.put("/trailers/{trailer_id}", response_model=TrailerOut)
def update_trailer(trailer_id: int, trailer_in: TrailerUpdate, db: Session = Depends(get_db)):
    trailer = crud.update_trailer(db, trailer_id, trailer_in)
    if not trailer:
        raise HTTPException(404, "Trailer not found")
    return trailer


# ─── Brokers ──────────────────────────────────────────────────────────────────

@router.get("/brokers", response_model=List[BrokerOut])
def list_brokers(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    return crud.get_brokers(db, is_active)


@router.post("/brokers", response_model=BrokerOut, status_code=201)
def create_broker(broker_in: BrokerCreate, db: Session = Depends(get_db)):
    return crud.create_broker(db, broker_in)


@router.put("/brokers/{broker_id}", response_model=BrokerOut)
def update_broker(broker_id: int, broker_in: BrokerUpdate, db: Session = Depends(get_db)):
    broker = crud.update_broker(db, broker_id, broker_in)
    if not broker:
        raise HTTPException(404, "Broker not found")
    return broker


# ─── Dispatchers ──────────────────────────────────────────────────────────────

@router.get("/dispatchers", response_model=List[DispatcherOut])
def list_dispatchers(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    return crud.get_dispatchers(db, is_active)


@router.post("/dispatchers", response_model=DispatcherOut, status_code=201)
def create_dispatcher(dispatcher_in: DispatcherCreate, db: Session = Depends(get_db)):
    return crud.create_dispatcher(db, dispatcher_in)
