from datetime import date

from app.models import Frequency
from app.services.bills import occurrences


def due(start, freq, window_start, window_end):
    return list(occurrences(start, freq, window_start, window_end))


def test_monthly_clamps_to_end_of_short_months():
    result = due(date(2026, 1, 31), Frequency.monthly, date(2026, 1, 1), date(2026, 4, 30))
    assert result == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)]


def test_monthly_does_not_start_before_start_date():
    result = due(date(2026, 3, 15), Frequency.monthly, date(2026, 1, 1), date(2026, 4, 30))
    assert result == [date(2026, 3, 15), date(2026, 4, 15)]


def test_biweekly_lands_on_the_right_weeks():
    result = due(date(2026, 1, 2), Frequency.biweekly, date(2026, 2, 1), date(2026, 2, 28))
    assert result == [date(2026, 2, 13), date(2026, 2, 27)]


def test_weekly_window_before_start_is_empty():
    assert due(date(2026, 6, 1), Frequency.weekly, date(2026, 1, 1), date(2026, 1, 31)) == []


def test_yearly_handles_leap_day():
    result = due(date(2024, 2, 29), Frequency.yearly, date(2025, 1, 1), date(2025, 12, 31))
    assert result == [date(2025, 2, 28)]


def test_calendar_endpoint_statuses(client):
    bill = client.post(
        "/bills",
        json={"name": "Rent", "amount": "1500", "frequency": "monthly", "start_date": "2020-01-01"},
    ).json()
    client.post(f"/bills/{bill['id']}/payments", json={"due_date": "2020-03-01"})

    march = client.get("/bills/calendar", params={"month": "2020-03"}).json()
    assert [(e["due_date"], e["status"]) for e in march] == [("2020-03-01", "paid")]

    april = client.get("/bills/calendar", params={"month": "2020-04"}).json()
    assert april[0]["status"] == "overdue"

    client.delete(f"/bills/{bill['id']}/payments", params={"due_date": "2020-03-01"})
    march = client.get("/bills/calendar", params={"month": "2020-03"}).json()
    assert march[0]["status"] == "overdue"


def test_marking_paid_twice_is_idempotent(client):
    bill = client.post(
        "/bills",
        json={"name": "Phone", "amount": "60", "frequency": "monthly", "start_date": "2020-01-10"},
    ).json()
    for _ in range(2):
        assert (
            client.post(f"/bills/{bill['id']}/payments", json={"due_date": "2020-01-10"}).status_code
            == 201
        )
