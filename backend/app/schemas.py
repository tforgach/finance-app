from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from .models import AccountType, Frequency


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: AccountType
    balance: Decimal = Decimal("0")
    apr: Decimal | None = Field(default=None, ge=0, le=100)
    credit_limit: Decimal | None = Field(default=None, ge=0)
    min_payment: Decimal | None = Field(default=None, ge=0)
    due_day: int | None = Field(default=None, ge=1, le=31)


class AccountOut(ORMModel, AccountCreate):
    id: int


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class CategoryOut(ORMModel, CategoryCreate):
    id: int


class TransactionCreate(BaseModel):
    account_id: int
    category_id: int | None = None
    date: date
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal
    is_transfer: bool = False


class TransactionOut(ORMModel, TransactionCreate):
    id: int


class TransactionUpdate(BaseModel):
    category_id: int | None = None
    is_transfer: bool = False


class ImportOut(BaseModel):
    imported: int
    skipped_duplicates: int
    errors: list[str]


class BillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(ge=0)
    frequency: Frequency
    start_date: date
    autopay: bool = False
    account_id: int | None = None


class BillOut(ORMModel, BillCreate):
    id: int
    active: bool


class CalendarEntryOut(BaseModel):
    bill_id: int
    name: str
    amount: Decimal
    due_date: date
    autopay: bool
    status: str


class PaymentCreate(BaseModel):
    due_date: date
    paid_on: date | None = None


class BudgetSet(BaseModel):
    monthly_limit: Decimal = Field(ge=0)


class BudgetLine(BaseModel):
    category_id: int | None
    category: str
    limit: Decimal | None
    spent: Decimal
    remaining: Decimal | None
    percent_used: float | None


class BudgetSummary(BaseModel):
    month: str
    total_limit: Decimal
    total_spent: Decimal
    lines: list[BudgetLine]


class SpendingSummary(BaseModel):
    month: str
    income: Decimal
    spending: Decimal
    net: Decimal
    by_category: list[dict]


class DebtLine(BaseModel):
    id: int
    name: str
    type: AccountType
    balance: Decimal
    apr: Decimal | None
    min_payment: Decimal | None
    utilization: float | None
    monthly_interest: Decimal


class DebtSummary(BaseModel):
    total_debt: Decimal
    total_min_payments: Decimal
    estimated_monthly_interest: Decimal
    debts: list[DebtLine]


class PayoffOut(BaseModel):
    strategy: str
    months: int | None
    paid_off: bool
    total_interest: Decimal
    payoff_order: list[dict]


class PayoffCompare(BaseModel):
    extra_payment: Decimal
    avalanche: PayoffOut
    snowball: PayoffOut
    interest_saved_by_avalanche: Decimal | None
