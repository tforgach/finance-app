from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Bill, BillPayment
from ..schemas import BillCreate, BillOut, CalendarEntryOut, PaymentCreate
from ..services.bills import build_calendar
from ..services.budget import month_range

router = APIRouter(prefix="/bills", tags=["bills"])


@router.post("", response_model=BillOut, status_code=201)
def create_bill(body: BillCreate, db: Session = Depends(get_db)):
    bill = Bill(**body.model_dump())
    db.add(bill)
    db.commit()
    return bill


@router.get("", response_model=list[BillOut])
def list_bills(db: Session = Depends(get_db)):
    return db.scalars(select(Bill).order_by(Bill.name)).all()


@router.delete("/{bill_id}", status_code=204)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.get(Bill, bill_id)
    if bill is None:
        raise HTTPException(404, "Bill not found")
    db.delete(bill)
    db.commit()


@router.get("/calendar", response_model=list[CalendarEntryOut])
def calendar(
    month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"), db: Session = Depends(get_db)
):
    start, end = month_range(month)
    return build_calendar(db, start, end - timedelta(days=1), today=date.today())


@router.get("/upcoming", response_model=list[CalendarEntryOut])
def upcoming(days: int = Query(14, ge=1, le=365), db: Session = Depends(get_db)):
    today = date.today()
    entries = build_calendar(db, today - timedelta(days=30), today + timedelta(days=days), today)
    return [e for e in entries if e.status != "paid"]


@router.post("/{bill_id}/payments", status_code=201)
def mark_paid(bill_id: int, body: PaymentCreate, db: Session = Depends(get_db)):
    if db.get(Bill, bill_id) is None:
        raise HTTPException(404, "Bill not found")
    existing = db.scalar(
        select(BillPayment).where(
            BillPayment.bill_id == bill_id, BillPayment.due_date == body.due_date
        )
    )
    if existing is None:
        db.add(
            BillPayment(
                bill_id=bill_id,
                due_date=body.due_date,
                paid_on=body.paid_on or date.today(),
            )
        )
        db.commit()
    return {"bill_id": bill_id, "due_date": body.due_date, "status": "paid"}


@router.delete("/{bill_id}/payments", status_code=204)
def mark_unpaid(bill_id: int, due_date: date, db: Session = Depends(get_db)):
    payment = db.scalar(
        select(BillPayment).where(
            BillPayment.bill_id == bill_id, BillPayment.due_date == due_date
        )
    )
    if payment is not None:
        db.delete(payment)
        db.commit()
