from calendar import monthrange
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Bill, BillPayment, Frequency


def occurrences(
    start_date: date, frequency: Frequency, window_start: date, window_end: date
) -> Iterator[date]:
    """Yield due dates of a recurring bill that fall within [window_start, window_end]."""
    if frequency in (Frequency.weekly, Frequency.biweekly):
        step = timedelta(days=7 if frequency == Frequency.weekly else 14)
        current = start_date
        if current < window_start:
            current += step * ((window_start - current).days // step.days)
            if current < window_start:
                current += step
        while current <= window_end:
            yield current
            current += step
        return

    if frequency == Frequency.monthly:
        year, month = window_start.year, window_start.month
        while (year, month) <= (window_end.year, window_end.month):
            day = min(start_date.day, monthrange(year, month)[1])
            due = date(year, month, day)
            if due >= start_date and window_start <= due <= window_end:
                yield due
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)
        return

    for year in range(window_start.year, window_end.year + 1):
        day = min(start_date.day, monthrange(year, start_date.month)[1])
        due = date(year, start_date.month, day)
        if due >= start_date and window_start <= due <= window_end:
            yield due


@dataclass
class CalendarEntry:
    bill_id: int
    name: str
    amount: Decimal
    due_date: date
    autopay: bool
    status: str  # "paid" | "overdue" | "upcoming"


def build_calendar(
    db: Session, window_start: date, window_end: date, today: date
) -> list[CalendarEntry]:
    bills = db.scalars(select(Bill).where(Bill.active.is_(True))).all()
    payments = db.scalars(
        select(BillPayment).where(
            BillPayment.due_date >= window_start, BillPayment.due_date <= window_end
        )
    ).all()
    paid = {(p.bill_id, p.due_date) for p in payments}

    entries = []
    for bill in bills:
        for due in occurrences(bill.start_date, bill.frequency, window_start, window_end):
            if (bill.id, due) in paid:
                status = "paid"
            elif due < today:
                status = "overdue"
            else:
                status = "upcoming"
            entries.append(
                CalendarEntry(bill.id, bill.name, bill.amount, due, bill.autopay, status)
            )
    return sorted(entries, key=lambda e: (e.due_date, e.name))
