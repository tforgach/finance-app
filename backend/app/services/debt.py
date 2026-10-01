from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
MAX_MONTHS = 600


@dataclass
class Debt:
    id: int
    name: str
    balance: Decimal
    apr: Decimal
    min_payment: Decimal


@dataclass
class PayoffResult:
    strategy: str
    months: int | None  # None if the debts are never paid off
    total_interest: Decimal
    payoff_months: dict[int, int] = field(default_factory=dict)


def _round(value: Decimal) -> Decimal:
    return value.quantize(CENT, ROUND_HALF_UP)


def simulate_payoff(debts: list[Debt], strategy: str, extra: Decimal = Decimal("0")) -> PayoffResult:
    """Month-by-month payoff. The monthly budget (all minimums + extra) stays constant,
    so the minimum of a paid-off debt rolls into the next target."""
    if strategy not in ("avalanche", "snowball"):
        raise ValueError(f"unknown strategy: {strategy}")

    by_id = {d.id: d for d in debts if d.balance > 0}
    balances = {i: d.balance for i, d in by_id.items()}
    budget = sum((d.min_payment for d in by_id.values()), Decimal("0")) + extra
    total_interest = Decimal("0")
    payoff_months: dict[int, int] = {}
    month = 0

    while balances and month < MAX_MONTHS:
        month += 1
        for i in balances:
            interest = _round(balances[i] * by_id[i].apr / Decimal(1200))
            balances[i] += interest
            total_interest += interest

        remaining = budget
        for i in balances:
            pay = min(by_id[i].min_payment, balances[i], remaining)
            balances[i] -= pay
            remaining -= pay

        if strategy == "avalanche":
            priority = sorted(balances, key=lambda i: (-by_id[i].apr, i))
        else:
            priority = sorted(balances, key=lambda i: (balances[i], i))
        for i in priority:
            if remaining <= 0:
                break
            pay = min(remaining, balances[i])
            balances[i] -= pay
            remaining -= pay

        for i in [i for i, b in balances.items() if b <= 0]:
            payoff_months[i] = month
            del balances[i]

    return PayoffResult(
        strategy=strategy,
        months=None if balances else month,
        total_interest=total_interest,
        payoff_months=payoff_months,
    )
