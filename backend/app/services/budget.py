from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Category, Transaction


def month_range(month: str) -> tuple[date, date]:
    """Parse 'YYYY-MM' into [start, end) dates."""
    year, mon = (int(part) for part in month.split("-"))
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def spending_by_category(db: Session, start: date, end: date) -> dict[int | None, Decimal]:
    rows = db.execute(
        select(Transaction.category_id, func.sum(Transaction.amount))
        .where(
            Transaction.date >= start,
            Transaction.date < end,
            Transaction.amount < 0,
            Transaction.is_transfer.is_(False),
        )
        .group_by(Transaction.category_id)
    ).all()
    return {category_id: -total for category_id, total in rows}


def income_total(db: Session, start: date, end: date) -> Decimal:
    total = db.scalar(
        select(func.sum(Transaction.amount)).where(
            Transaction.date >= start,
            Transaction.date < end,
            Transaction.amount > 0,
            Transaction.is_transfer.is_(False),
        )
    )
    return total or Decimal("0")


def category_names(db: Session) -> dict[int, str]:
    return {c.id: c.name for c in db.scalars(select(Category))}
