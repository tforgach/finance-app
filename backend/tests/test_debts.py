from decimal import Decimal

from app.services.debt import Debt, simulate_payoff


def test_zero_apr_single_debt_pays_off_in_exact_months():
    debts = [Debt(1, "Loan", Decimal("1000"), Decimal("0"), Decimal("100"))]
    result = simulate_payoff(debts, "avalanche")
    assert result.months == 10
    assert result.total_interest == 0


def test_extra_payment_shortens_payoff():
    debts = [Debt(1, "Card", Decimal("1000"), Decimal("20"), Decimal("50"))]
    slow = simulate_payoff(debts, "avalanche")
    fast = simulate_payoff(debts, "avalanche", Decimal("100"))
    assert fast.months < slow.months
    assert fast.total_interest < slow.total_interest


def test_avalanche_never_pays_more_interest_than_snowball():
    debts = [
        Debt(1, "Small low-rate", Decimal("500"), Decimal("5"), Decimal("25")),
        Debt(2, "Big high-rate", Decimal("5000"), Decimal("25"), Decimal("100")),
    ]
    avalanche = simulate_payoff(debts, "avalanche", Decimal("200"))
    snowball = simulate_payoff(debts, "snowball", Decimal("200"))
    assert avalanche.total_interest <= snowball.total_interest
    assert snowball.payoff_months[1] < snowball.payoff_months[2]


def test_minimum_below_interest_never_pays_off():
    debts = [Debt(1, "Trap", Decimal("10000"), Decimal("24"), Decimal("100"))]
    assert simulate_payoff(debts, "avalanche").months is None


def test_debt_endpoints(client):
    client.post(
        "/accounts",
        json={
            "name": "Visa",
            "type": "credit_card",
            "balance": "2000",
            "apr": "24",
            "credit_limit": "8000",
            "min_payment": "60",
        },
    )
    client.post("/accounts", json={"name": "Checking", "type": "checking", "balance": "900"})

    summary = client.get("/debts/summary").json()
    assert len(summary["debts"]) == 1
    assert summary["debts"][0]["utilization"] == 25.0
    assert Decimal(summary["total_debt"]) == Decimal("2000")
    assert Decimal(summary["estimated_monthly_interest"]) == Decimal("40.00")

    payoff = client.get("/debts/payoff", params={"extra": "100"}).json()
    assert payoff["avalanche"]["paid_off"] is True
    assert payoff["avalanche"]["payoff_order"][0]["name"] == "Visa"
