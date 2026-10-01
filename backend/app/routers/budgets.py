from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Budget, Category
from ..schemas import BudgetLine, BudgetSet, BudgetSummary, SpendingSummary
from ..services.budget import category_names, income_total, month_range, spending_by_category

router = APIRouter(tags=["budgets"])
MONTH = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


@router.put("/budgets/{category_id}")
def set_budget(category_id: int, body: BudgetSet, db: Session = Depends(get_db)):
    if db.get(Category, category_id) is None:
        raise HTTPException(404, "Category not found")
    budget = db.scalar(select(Budget).where(Budget.category_id == category_id))
    if budget is None:
        budget = Budget(category_id=category_id, monthly_limit=body.monthly_limit)
        db.add(budget)
    else:
        budget.monthly_limit = body.monthly_limit
    db.commit()
    return {"category_id": category_id, "monthly_limit": budget.monthly_limit}


@router.delete("/budgets/{category_id}", status_code=204)
def delete_budget(category_id: int, db: Session = Depends(get_db)):
    budget = db.scalar(select(Budget).where(Budget.category_id == category_id))
    if budget is not None:
        db.delete(budget)
        db.commit()


@router.get("/budgets/summary", response_model=BudgetSummary)
def budget_summary(month: str = MONTH, db: Session = Depends(get_db)):
    start, end = month_range(month)
    spent = spending_by_category(db, start, end)
    names = category_names(db)
    limits = {b.category_id: b.monthly_limit for b in db.scalars(select(Budget))}

    lines = []
    for category_id in sorted(set(limits) | set(spent), key=lambda c: (c is None, names.get(c, ""))):
        limit = limits.get(category_id)
        amount = spent.get(category_id, Decimal("0"))
        lines.append(
            BudgetLine(
                category_id=category_id,
                category=names.get(category_id, "Uncategorized"),
                limit=limit,
                spent=amount,
                remaining=limit - amount if limit is not None else None,
                percent_used=round(float(amount / limit) * 100, 1) if limit else None,
            )
        )
    return BudgetSummary(
        month=month,
        total_limit=sum(limits.values(), Decimal("0")),
        total_spent=sum(spent.values(), Decimal("0")),
        lines=lines,
    )


@router.get("/spending/summary", response_model=SpendingSummary)
def spending_summary(month: str = MONTH, db: Session = Depends(get_db)):
    start, end = month_range(month)
    spent = spending_by_category(db, start, end)
    names = category_names(db)
    income = income_total(db, start, end)
    total = sum(spent.values(), Decimal("0"))
    by_category = sorted(
        (
            {"category_id": c, "category": names.get(c, "Uncategorized"), "spent": amount}
            for c, amount in spent.items()
        ),
        key=lambda row: row["spent"],
        reverse=True,
    )
    return SpendingSummary(
        month=month, income=income, spending=total, net=income - total, by_category=by_category
    )
