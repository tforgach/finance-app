from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import DEBT_TYPES, Account, AccountType
from ..schemas import DebtLine, DebtSummary, PayoffCompare, PayoffOut
from ..services.debt import Debt, PayoffResult, simulate_payoff

router = APIRouter(prefix="/debts", tags=["debts"])


def _debt_accounts(db: Session) -> list[Account]:
    query = select(Account).where(Account.type.in_(DEBT_TYPES), Account.balance > 0)
    return list(db.scalars(query.order_by(Account.id)))


def _monthly_interest(account: Account) -> Decimal:
    return (account.balance * (account.apr or Decimal("0")) / Decimal(1200)).quantize(Decimal("0.01"))


def _to_out(result: PayoffResult, names: dict[int, str]) -> PayoffOut:
    order = sorted(result.payoff_months.items(), key=lambda item: item[1])
    return PayoffOut(
        strategy=result.strategy,
        months=result.months,
        paid_off=result.months is not None,
        total_interest=result.total_interest,
        payoff_order=[{"id": i, "name": names[i], "month": m} for i, m in order],
    )


@router.get("/summary", response_model=DebtSummary)
def summary(db: Session = Depends(get_db)):
    accounts = _debt_accounts(db)
    lines = [
        DebtLine(
            id=a.id,
            name=a.name,
            type=a.type,
            balance=a.balance,
            apr=a.apr,
            min_payment=a.min_payment,
            utilization=(
                round(float(a.balance / a.credit_limit) * 100, 1)
                if a.type == AccountType.credit_card and a.credit_limit
                else None
            ),
            monthly_interest=_monthly_interest(a),
        )
        for a in accounts
    ]
    return DebtSummary(
        total_debt=sum((a.balance for a in accounts), Decimal("0")),
        total_min_payments=sum((a.min_payment or Decimal("0") for a in accounts), Decimal("0")),
        estimated_monthly_interest=sum((line.monthly_interest for line in lines), Decimal("0")),
        debts=lines,
    )


@router.get("/payoff", response_model=PayoffCompare)
def payoff(extra: Decimal = Query(Decimal("0"), ge=0), db: Session = Depends(get_db)):
    accounts = _debt_accounts(db)
    debts = [
        Debt(a.id, a.name, a.balance, a.apr or Decimal("0"), a.min_payment or Decimal("0"))
        for a in accounts
    ]
    names = {a.id: a.name for a in accounts}
    avalanche = simulate_payoff(debts, "avalanche", extra)
    snowball = simulate_payoff(debts, "snowball", extra)
    saved = (
        snowball.total_interest - avalanche.total_interest
        if avalanche.months is not None and snowball.months is not None
        else None
    )
    return PayoffCompare(
        extra_payment=extra,
        avalanche=_to_out(avalanche, names),
        snowball=_to_out(snowball, names),
        interest_saved_by_avalanche=saved,
    )
