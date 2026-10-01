from decimal import Decimal

CSV = """Date,Description,Amount,Category
2026-10-01,Paycheck,2500.00,Income
2026-10-02,Grocery Store,-85.50,Groceries
10/03/2026,Coffee,-4.25,Dining
2026-10-04,Grocery Store,-40.00,Groceries
2026-10-05,Mystery,-10.00,
not-a-date,Bad row,-1.00,
"""


def make_account(client):
    return client.post("/accounts", json={"name": "Checking", "type": "checking"}).json()["id"]


def import_csv(client, account_id, content=CSV):
    return client.post(
        "/transactions/import",
        params={"account_id": account_id},
        files={"file": ("tx.csv", content, "text/csv")},
    ).json()


def test_csv_import_reports_imports_duplicates_and_errors(client):
    account_id = make_account(client)
    first = import_csv(client, account_id)
    assert first["imported"] == 5
    assert len(first["errors"]) == 1 and "line 7" in first["errors"][0]

    second = import_csv(client, account_id)
    assert second["imported"] == 0
    assert second["skipped_duplicates"] == 5


def test_budget_summary_compares_limits_to_spending(client):
    account_id = make_account(client)
    import_csv(client, account_id)
    categories = {c["name"]: c["id"] for c in client.get("/categories").json()}

    client.put(f"/budgets/{categories['Groceries']}", json={"monthly_limit": "100"})
    client.put(f"/budgets/{categories['Groceries']}", json={"monthly_limit": "150"})

    summary = client.get("/budgets/summary", params={"month": "2026-10"}).json()
    lines = {line["category"]: line for line in summary["lines"]}
    groceries = lines["Groceries"]
    assert Decimal(groceries["spent"]) == Decimal("125.50")
    assert Decimal(groceries["remaining"]) == Decimal("24.50")
    assert groceries["percent_used"] == 83.7
    assert Decimal(lines["Uncategorized"]["spent"]) == Decimal("10.00")
    assert "Income" not in lines


def test_spending_summary_totals(client):
    account_id = make_account(client)
    import_csv(client, account_id)

    summary = client.get("/spending/summary", params={"month": "2026-10"}).json()
    assert Decimal(summary["income"]) == Decimal("2500.00")
    assert Decimal(summary["spending"]) == Decimal("139.75")
    assert Decimal(summary["net"]) == Decimal("2360.25")
    assert summary["by_category"][0]["category"] == "Groceries"


def test_month_param_is_validated(client):
    assert client.get("/budgets/summary", params={"month": "2026-13"}).status_code == 422


TRANSFER_CSV = """date,description,amount,category
2026-10-01,Paycheck,3000.00,Income
2026-10-02,Groceries,-100.00,Groceries
2026-10-03,Card payment,-500.00,Transfer
2026-10-04,Move to savings,-250.00,transfer
"""


def test_transfers_are_excluded_from_spending_and_budgets(client):
    account_id = make_account(client)
    result = import_csv(client, account_id, TRANSFER_CSV)
    assert result["imported"] == 4

    summary = client.get("/spending/summary", params={"month": "2026-10"}).json()
    assert Decimal(summary["spending"]) == Decimal("100.00")
    assert [row["category"] for row in summary["by_category"]] == ["Groceries"]

    budget = client.get("/budgets/summary", params={"month": "2026-10"}).json()
    assert Decimal(budget["total_spent"]) == Decimal("100.00")
    assert "Transfer" not in {c["name"] for c in client.get("/categories").json()}


def test_patch_transaction_sets_category_and_transfer_flag(client):
    account_id = make_account(client)
    import_csv(client, account_id, "date,description,amount\n2026-10-02,Mystery,-40.00\n")
    category = client.post("/categories", json={"name": "Fun"}).json()
    tx = client.get("/transactions").json()[0]
    assert tx["category_id"] is None and tx["is_transfer"] is False

    updated = client.patch(
        f"/transactions/{tx['id']}", json={"category_id": category["id"], "is_transfer": False}
    ).json()
    assert updated["category_id"] == category["id"]
    spending = client.get("/spending/summary", params={"month": "2026-10"}).json()
    assert spending["by_category"][0]["category"] == "Fun"

    flagged = client.patch(
        f"/transactions/{tx['id']}", json={"category_id": category["id"], "is_transfer": True}
    ).json()
    assert flagged["is_transfer"] is True and flagged["category_id"] is None
    spending = client.get("/spending/summary", params={"month": "2026-10"}).json()
    assert Decimal(spending["spending"]) == 0


def test_patch_unknown_transaction_or_category_is_404(client):
    assert client.patch("/transactions/999", json={"is_transfer": True}).status_code == 404
    account_id = make_account(client)
    import_csv(client, account_id, "date,description,amount\n2026-10-02,Thing,-1.00\n")
    tx = client.get("/transactions").json()[0]
    assert client.patch(f"/transactions/{tx['id']}", json={"category_id": 999}).status_code == 404
