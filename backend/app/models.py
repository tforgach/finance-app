import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint, false
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class AccountType(str, enum.Enum):
    checking = "checking"
    savings = "savings"
    credit_card = "credit_card"
    loan = "loan"


class Frequency(str, enum.Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    yearly = "yearly"


DEBT_TYPES = (AccountType.credit_card, AccountType.loan)


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[AccountType] = mapped_column(Enum(AccountType, native_enum=False, length=20))
    # For credit cards and loans, balance is the amount owed (positive).
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    apr: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    min_payment: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    due_day: Mapped[int | None] = mapped_column(Integer)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    date: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str] = mapped_column(String(255))
    # Negative = money out (spending), positive = money in.
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Card payments and account-to-account moves are not spending.
    is_transfer: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    frequency: Mapped[Frequency] = mapped_column(Enum(Frequency, native_enum=False, length=20))
    # First due date; later due dates are derived from the frequency.
    start_date: Mapped[date] = mapped_column(Date)
    autopay: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"))


class BillPayment(Base):
    __tablename__ = "bill_payments"
    __table_args__ = (UniqueConstraint("bill_id", "due_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    bill_id: Mapped[int] = mapped_column(ForeignKey("bills.id", ondelete="CASCADE"), index=True)
    due_date: Mapped[date] = mapped_column(Date)
    paid_on: Mapped[date] = mapped_column(Date)


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), unique=True
    )
    monthly_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2))
