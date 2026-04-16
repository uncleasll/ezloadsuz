from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from app.db.session import get_db
from app.schemas.payroll_schemas import (
    SettlementCreate, SettlementUpdate, SettlementOut,
    SettlementPaymentCreate, SettlementAdjustmentCreate,
)
from app.crud import payroll as crud
from app.services.pdf_service import generate_settlement_pdf

router = APIRouter(prefix="/payroll", tags=["payroll"])


# ─── helpers ──────────────────────────────────────────────────────────────────

def _ser_item(i):
    load_data = None
    if i.load:
        load_data = {
            "load_number": i.load.load_number,
            "status": i.load.status.value if i.load.status else None,
            "billing_status": i.load.billing_status.value if i.load.billing_status else None,
            "actual_delivery_date": str(i.load.actual_delivery_date) if i.load.actual_delivery_date else None,
            "load_date": str(i.load.load_date) if i.load.load_date else None,
        }
    return {
        "id": i.id, "load_id": i.load_id, "item_type": i.item_type,
        "description": i.description, "amount": i.amount,
        "load_date": str(i.load_date) if i.load_date else None,
        "load_status": i.load_status, "load_billing_status": i.load_billing_status,
        "load_pickup_city": i.load_pickup_city, "load_delivery_city": i.load_delivery_city,
        "amount_snapshot": i.amount_snapshot,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "load": load_data,
    }


def _ser_adj(a):
    return {
        "id": a.id, "adj_type": a.adj_type,
        "date": str(a.date) if a.date else None,
        "category": a.category, "description": a.description, "amount": a.amount,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _ser_payment(p):
    return {
        "id": p.id, "payment_number": p.payment_number,
        "description": p.description, "amount": p.amount,
        "payment_date": str(p.payment_date) if p.payment_date else None,
        "is_carryover": p.is_carryover,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _ser_history(h):
    return {
        "id": h.id, "description": h.description, "author": h.author,
        "created_at": h.created_at.isoformat() if h.created_at else None,
    }


def _serialize(s) -> dict:
    return {
        "id": s.id,
        "settlement_number": s.settlement_number,
        "driver_id": s.driver_id,
        "payable_to": s.payable_to,
        "status": s.status.value,
        "date": str(s.date),
        "settlement_total": s.settlement_total,
        "balance_due": s.balance_due,
        "notes": s.notes,
        "qb_exported": s.qb_exported,
        "qb_exported_at": s.qb_exported_at.isoformat() if s.qb_exported_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "driver": {"id": s.driver.id, "name": s.driver.name, "driver_type": s.driver.driver_type} if s.driver else None,
        "items": [_ser_item(i) for i in (s.items or [])],
        "adjustments": [_ser_adj(a) for a in (s.adjustments or [])],
        "payments": [_ser_payment(p) for p in (s.payments or [])],
        "history": [_ser_history(h) for h in (s.history or [])],
    }


# ─── list ─────────────────────────────────────────────────────────────────────

@router.get("")
def list_settlements(
    page: int = Query(1, ge=1),
    page_size: int = Query(25),
    driver_id: Optional[int] = None,
    status: Optional[str] = None,
    settlement_number: Optional[int] = None,
    amount_from: Optional[float] = None,
    amount_to: Optional[float] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    payable_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    result = crud.get_settlements(
        db, page=page, page_size=page_size,
        driver_id=driver_id, status=status,
        settlement_number=settlement_number,
        amount_from=amount_from, amount_to=amount_to,
        date_from=date_from, date_to=date_to, payable_to=payable_to,
    )
    items = []
    for s in result["items"]:
        items.append({
            "id": s.id,
            "settlement_number": s.settlement_number,
            "driver_id": s.driver_id,
            "payable_to": s.payable_to,
            "status": s.status.value,
            "date": str(s.date),
            "settlement_total": s.settlement_total,
            "balance_due": s.balance_due,
            "qb_exported": s.qb_exported,
            "driver": {"id": s.driver.id, "name": s.driver.name, "driver_type": s.driver.driver_type} if s.driver else None,
        })
    return {**result, "items": items}


# ─── open balances ────────────────────────────────────────────────────────────

@router.get("/open-balances")
def get_open_balances(
    driver_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    date_type: str = Query("pickup", regex="^(pickup|delivery)$"),
    db: Session = Depends(get_db),
):
    balances = crud.get_open_balances(db, driver_id=driver_id, date_from=date_from, date_to=date_to, date_type=date_type)
    return [
        {
            "driver_id": b["driver_id"],
            "driver_name": b["driver_name"],
            "driver_type": b["driver_type"],
            "payable_to": b["payable_to"],
            "balance": b["balance"],
            "updated": str(b["updated"]) if b["updated"] else None,
        }
        for b in balances
    ]


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_settlement(data: SettlementCreate, db: Session = Depends(get_db)):
    s = crud.create_settlement(db, data)
    return _serialize(s)


@router.get("/{settlement_id}")
def get_settlement(settlement_id: int, db: Session = Depends(get_db)):
    s = crud.get_settlement(db, settlement_id)
    if not s:
        raise HTTPException(404, "Settlement not found")
    return _serialize(s)


@router.put("/{settlement_id}")
def update_settlement(settlement_id: int, data: SettlementUpdate, db: Session = Depends(get_db)):
    s = crud.update_settlement(db, settlement_id, data)
    if not s:
        raise HTTPException(404, "Settlement not found")
    return _serialize(s)


@router.delete("/{settlement_id}")
def delete_settlement(settlement_id: int, db: Session = Depends(get_db)):
    if not crud.delete_settlement(db, settlement_id):
        raise HTTPException(404, "Settlement not found")
    return {"message": "Deleted"}


# ─── items ────────────────────────────────────────────────────────────────────

@router.post("/{settlement_id}/items/load/{load_id}", status_code=201)
def add_load_item(settlement_id: int, load_id: int, db: Session = Depends(get_db)):
    item = crud.add_load_item(db, settlement_id, load_id)
    if not item:
        raise HTTPException(404, "Load not found or already in settlement")
    return _ser_item(item)


@router.delete("/{settlement_id}/items/{item_id}")
def remove_item(settlement_id: int, item_id: int, db: Session = Depends(get_db)):
    if not crud.remove_item(db, settlement_id, item_id):
        raise HTTPException(404, "Item not found")
    return {"message": "Removed"}


# ─── adjustments ──────────────────────────────────────────────────────────────

@router.post("/{settlement_id}/adjustments", status_code=201)
def add_adjustment(settlement_id: int, data: SettlementAdjustmentCreate, db: Session = Depends(get_db)):
    adj = crud.add_adjustment(db, settlement_id, data)
    return _ser_adj(adj)


@router.delete("/{settlement_id}/adjustments/{adj_id}")
def delete_adjustment(settlement_id: int, adj_id: int, db: Session = Depends(get_db)):
    if not crud.delete_adjustment(db, settlement_id, adj_id):
        raise HTTPException(404, "Adjustment not found")
    return {"message": "Deleted"}


# ─── payments ─────────────────────────────────────────────────────────────────

@router.post("/{settlement_id}/payments", status_code=201)
def add_payment(settlement_id: int, data: SettlementPaymentCreate, db: Session = Depends(get_db)):
    p = crud.add_payment(db, settlement_id, data)
    return _ser_payment(p)


@router.delete("/{settlement_id}/payments/{payment_id}")
def delete_payment(settlement_id: int, payment_id: int, db: Session = Depends(get_db)):
    if not crud.delete_payment(db, settlement_id, payment_id):
        raise HTTPException(404, "Payment not found")
    return {"message": "Deleted"}


# ─── QB export ────────────────────────────────────────────────────────────────

@router.post("/{settlement_id}/export-qb")
def export_qb(settlement_id: int, db: Session = Depends(get_db)):
    s = crud.get_settlement(db, settlement_id)
    if not s:
        raise HTTPException(404, "Settlement not found")
    crud.mark_qb_exported(db, settlement_id)
    return {"message": "Exported to QuickBooks", "settlement_number": s.settlement_number}


# ─── PDF ──────────────────────────────────────────────────────────────────────

@router.get("/{settlement_id}/pdf")
def download_settlement_pdf(settlement_id: int, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    from app.models.models import Settlement, SettlementItem
    s = db.query(Settlement).options(
        joinedload(Settlement.driver),
        joinedload(Settlement.items).joinedload(SettlementItem.load),
        joinedload(Settlement.adjustments),
        joinedload(Settlement.payments),
    ).filter(Settlement.id == settlement_id).first()
    if not s:
        raise HTTPException(404, "Settlement not found")
    pdf = generate_settlement_pdf(s)
    driver_name = (s.driver.name if s.driver else "driver").replace(' ', '_')
    filename = f"driver_settlement_{s.settlement_number}_{driver_name}.pdf"
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={filename}"})
