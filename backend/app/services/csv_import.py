import csv
import io
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Category, Transaction

DATE_FORMATS = ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y")


@dataclass
class ImportResult:
    imported: int = 0
    skipped_duplicates: int = 0
    errors: list[str] = field(default_factory=list)


def parse_date(raw: str) -> date:
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"unrecognized date {raw!r}")


def parse_amount(raw: str) -> Decimal:
    text = raw.strip().replace("$", "").replace(",", "")
    negative = text.startswith("(") and text.endswith(")")
    try:
        value = Decimal(text.strip("()"))
    except InvalidOperation:
        raise ValueError(f"unrecognized amount {raw!r}") from None
    return -value if negative else value


def import_csv(db: Session, account_id: int, content: str) -> ImportResult:
    """Import rows with columns: date, description, amount[, category].

    A category named "Transfer" marks the row as a transfer (excluded from spending)."""
    result = ImportResult()
    reader = csv.DictReader(io.StringIO(content))
    categories = {c.name.lower(): c for c in db.scalars(select(Category))}

    for line, row in enumerate(reader, start=2):
        row = {(k or "").strip().lower(): (v or "") for k, v in row.items()}
        try:
            when = parse_date(row["date"])
            amount = parse_amount(row["amount"])
            description = row["description"].strip()
        except (KeyError, ValueError) as exc:
            result.errors.append(f"line {line}: {exc}")
            continue

        duplicate = db.scalar(
            select(Transaction.id).where(
                Transaction.account_id == account_id,
                Transaction.date == when,
                Transaction.description == description,
                Transaction.amount == amount,
            )
        )
        if duplicate:
            result.skipped_duplicates += 1
            continue

        category = None
        name = row.get("category", "").strip()
        is_transfer = name.lower() == "transfer"
        if name and not is_transfer:
            category = categories.get(name.lower())
            if category is None:
                category = Category(name=name)
                db.add(category)
                db.flush()
                categories[name.lower()] = category

        db.add(
            Transaction(
                account_id=account_id,
                category_id=category.id if category else None,
                date=when,
                description=description,
                amount=amount,
                is_transfer=is_transfer,
            )
        )
        result.imported += 1

    db.commit()
    return result
