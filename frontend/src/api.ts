import type {
  Account,
  Bill,
  BillCreate,
  BudgetSummary,
  CalendarEntry,
  Category,
  DebtCreate,
  DebtSummary,
  ImportResult,
  PayoffCompare,
  SpendingSummary,
  Transaction,
  TransactionUpdate,
} from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  calendar: (month: string) => request<CalendarEntry[]>(`/bills/calendar?month=${month}`),
  upcoming: (days: number) => request<CalendarEntry[]>(`/bills/upcoming?days=${days}`),
  createBill: (bill: BillCreate) =>
    request<Bill>("/bills", { method: "POST", body: JSON.stringify(bill) }),
  markPaid: (billId: number, dueDate: string) =>
    request(`/bills/${billId}/payments`, {
      method: "POST",
      body: JSON.stringify({ due_date: dueDate }),
    }),
  markUnpaid: (billId: number, dueDate: string) =>
    request<void>(`/bills/${billId}/payments?due_date=${dueDate}`, { method: "DELETE" }),
  debtSummary: () => request<DebtSummary>("/debts/summary"),
  payoff: (extra: string) =>
    request<PayoffCompare>(`/debts/payoff?extra=${encodeURIComponent(extra)}`),
  createDebt: (debt: DebtCreate) =>
    request("/accounts", { method: "POST", body: JSON.stringify(debt) }),
  deleteAccount: (id: number) => request<void>(`/accounts/${id}`, { method: "DELETE" }),
  accounts: () => request<Account[]>("/accounts"),
  createAccount: (account: { name: string; type: "checking" | "savings"; balance: string }) =>
    request<Account>("/accounts", { method: "POST", body: JSON.stringify(account) }),
  categories: () => request<Category[]>("/categories"),
  createCategory: (name: string) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify({ name }) }),
  transactions: (start: string, end: string) =>
    request<Transaction[]>(`/transactions?start=${start}&end=${end}&limit=500`),
  updateTransaction: (id: number, update: TransactionUpdate) =>
    request<Transaction>(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify(update) }),
  budgetSummary: (month: string) => request<BudgetSummary>(`/budgets/summary?month=${month}`),
  spendingSummary: (month: string) => request<SpendingSummary>(`/spending/summary?month=${month}`),
  setBudget: (categoryId: number, monthlyLimit: string) =>
    request(`/budgets/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify({ monthly_limit: monthlyLimit }),
    }),
  deleteBudget: (categoryId: number) =>
    request<void>(`/budgets/${categoryId}`, { method: "DELETE" }),
  importCsv: async (accountId: number, file: File): Promise<ImportResult> => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`${BASE}/transactions/import?account_id=${accountId}`, {
      method: "POST",
      body,
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  },
};
