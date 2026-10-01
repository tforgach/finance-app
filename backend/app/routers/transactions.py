from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Account, Category, Transaction
from ..schemas import (
    CategoryCreate,
    CategoryOut,
    ImportOut,
    TransactionCreate,
    TransactionOut,
    TransactionUpdate,
)
from ..services.csv_import import import_csv

router = APIRouter(tags=["transactions"])


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Category).where(Category.name == body.name)):
        raise HTTPException(409, "Category already exists")
    category = Category(name=body.name)
    db.add(category)
    db.commit()
    return category


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.name)).all()


@router.post("/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)):
    if db.get(Account, body.account_id) is None:
        raise HTTPException(404, "Account not found")
    transaction = Transaction(**body.model_dump())
    db.add(transaction)
    db.commit()
    return transaction


@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    account_id: int | None = None,
    category_id: int | None = None,
    start: date | None = None,
    end: date | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = select(Transaction).order_by(Transaction.date.desc(), Transaction.id.desc())
    if account_id is not None:
        query = query.where(Transaction.account_id == account_id)
    if category_id is not None:
        query = query.where(Transaction.category_id == category_id)
    if start is not None:
        query = query.where(Transaction.date >= start)
    if end is not None:
        query = query.where(Transaction.date <= end)
    return db.scalars(query.limit(limit)).all()


@router.patch("/transactions/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int, body: TransactionUpdate, db: Session = Depends(get_db)
):
    transaction = db.get(Transaction, transaction_id)
    if transaction is None:
        raise HTTPException(404, "Transaction not found")
    if body.category_id is not None and db.get(Category, body.category_id) is None:
        raise HTTPException(404, "Category not found")
    transaction.category_id = None if body.is_transfer else body.category_id
    transaction.is_transfer = body.is_transfer
    db.commit()
    return transaction


@router.post("/transactions/import", response_model=ImportOut)
async def import_transactions(account_id: int, file: UploadFile, db: Session = Depends(get_db)):
    if db.get(Account, account_id) is None:
        raise HTTPException(404, "Account not found")
    content = (await file.read()).decode("utf-8-sig")
    result = import_csv(db, account_id, content)
    return ImportOut(
        imported=result.imported,
        skipped_duplicates=result.skipped_duplicates,
        errors=result.errors,
    )
