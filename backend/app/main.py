from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import accounts, bills, budgets, debts, transactions

app = FastAPI(title="Finance App")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (accounts, transactions, bills, debts, budgets):
    app.include_router(module.router)


@app.get("/health")
def health():
    return {"status": "ok"}
