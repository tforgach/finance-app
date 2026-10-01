import { useState } from "react";
import type { FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import {
  TRANSFER_VALUE,
  budgetTone,
  categoryValue,
  monthBounds,
  parseCategoryValue,
} from "../lib/budget";
import { monthKey, shiftMonth } from "../lib/calendar";
import { formatDay, formatMoney } from "../lib/format";
import type { BudgetLine, Category, Transaction } from "../types";
import { ImportCard } from "./ImportCard";

function BudgetRow({ line, onSave }: { line: BudgetLine; onSave: (limit: string) => void }) {
  const saved = line.limit === null ? "" : String(Number(line.limit));
  const [draft, setDraft] = useState(saved);

  const percent = line.percent_used;
  const over = line.remaining !== null && Number(line.remaining) < 0;

  function commit() {
    if (draft !== saved) onSave(draft);
  }

  return (
    <li className="cat-row">
      <div className="cat-head">
        <strong>{line.category}</strong>
        {line.category_id !== null && (
          <label className="limit">
            <span className="sr-only">{line.category} monthly budget</span>
            <span aria-hidden="true">$</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="No budget"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
              }}
              onBlur={commit}
            />
          </label>
        )}
      </div>
      {percent !== null && (
        <div
          className="meter"
          role="meter"
          aria-label={`${line.category} budget used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(percent, 100)}
        >
          <div
            className={`meter-fill budget-${budgetTone(percent)}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
          <span>{percent}% used</span>
        </div>
      )}
      <div className="cat-foot">
        <span>{formatMoney(line.spent)} spent</span>
        {line.remaining !== null ? (
          <span className={over ? "over-text" : ""}>
            {over
              ? `${formatMoney(Math.abs(Number(line.remaining)))} over`
              : `${formatMoney(line.remaining)} left`}
          </span>
        ) : (
          <span className="muted">No budget set</span>
        )}
      </div>
    </li>
  );
}

function TransactionRow({
  tx,
  categories,
  onChange,
}: {
  tx: Transaction;
  categories: Category[];
  onChange: (value: string) => void;
}) {
  const amount = Number(tx.amount);
  return (
    <tr className={tx.is_transfer ? "tx-transfer" : ""}>
      <td>{formatDay(tx.date)}</td>
      <td>{tx.description}</td>
      <td>
        <select
          aria-label={`Category for ${tx.description}`}
          value={categoryValue(tx.category_id, tx.is_transfer)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={TRANSFER_VALUE}>Transfer (not spending)</option>
        </select>
      </td>
      <td className={`num ${amount > 0 ? "income" : ""}`}>{formatMoney(amount)}</td>
    </tr>
  );
}

function AddCategory() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => {
      setName("");
      return queryClient.invalidateQueries();
    },
  });

  return (
    <form
      className="card add-bill"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        create.mutate(name.trim());
      }}
    >
      <h2>Add a category</h2>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
      </label>
      <button type="submit" disabled={create.isPending}>
        Add category
      </button>
      {create.isError && <p className="error">That category may already exist.</p>}
    </form>
  );
}

export function BudgetPage({ initialDate }: { initialDate?: Date }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState(() => {
    const start = initialDate ?? new Date();
    return { year: start.getFullYear(), month0: start.getMonth() };
  });
  const month = monthKey(view.year, view.month0);
  const { start, end } = monthBounds(view.year, view.month0);
  const title = new Date(view.year, view.month0, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const keep = { placeholderData: keepPreviousData };
  const budget = useQuery({ queryKey: ["budget", month], queryFn: () => api.budgetSummary(month), ...keep });
  const spending = useQuery({ queryKey: ["spending", month], queryFn: () => api.spendingSummary(month), ...keep });
  const transactions = useQuery({ queryKey: ["transactions", month], queryFn: () => api.transactions(start, end), ...keep });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });

  const refresh = () => queryClient.invalidateQueries();
  const saveBudget = useMutation({
    mutationFn: ({ categoryId, limit }: { categoryId: number; limit: string }) =>
      limit.trim() === "" ? api.deleteBudget(categoryId) : api.setBudget(categoryId, limit),
    onSuccess: refresh,
  });
  const recategorize = useMutation({
    mutationFn: ({ id, value }: { id: number; value: string }) =>
      api.updateTransaction(id, parseCategoryValue(value)),
    onSuccess: refresh,
  });

  const lines = budget.data?.lines ?? [];
  const totalLimit = Number(budget.data?.total_limit ?? 0);
  const budgetedSpent = lines
    .filter((line) => line.limit !== null)
    .reduce((sum, line) => sum + Number(line.spent), 0);
  const net = Number(spending.data?.net ?? 0);

  return (
    <div className="bills">
      <div className="bills-main">
        <div className="toolbar">
          <h2>{title}</h2>
          <div className="toolbar-buttons">
            <button onClick={() => setView((v) => shiftMonth(v.year, v.month0, -1))}>← Prev</button>
            <button
              onClick={() => {
                const now = new Date();
                setView({ year: now.getFullYear(), month0: now.getMonth() });
              }}
            >
              Today
            </button>
            <button onClick={() => setView((v) => shiftMonth(v.year, v.month0, 1))}>Next →</button>
          </div>
        </div>

        {(budget.isError || spending.isError) && (
          <p className="error">Can't reach the API. Is the backend running on port 8000?</p>
        )}

        <div className="stats">
          <div className="card stat">
            <span>Income</span>
            <strong>{formatMoney(spending.data?.income ?? 0)}</strong>
          </div>
          <div className="card stat">
            <span>Spending</span>
            <strong>{formatMoney(spending.data?.spending ?? 0)}</strong>
          </div>
          <div className={`card stat ${net < 0 ? "stat-alert" : ""}`}>
            <span>Net</span>
            <strong>{formatMoney(net)}</strong>
          </div>
          <div className="card stat">
            <span>Budget left</span>
            <strong>{totalLimit > 0 ? formatMoney(totalLimit - budgetedSpent) : "—"}</strong>
          </div>
        </div>

        <section aria-label="Categories">
          <h2>Categories</h2>
          {budget.isSuccess && lines.length === 0 ? (
            <div className="card empty">
              <h2>Nothing here yet</h2>
              <p className="muted">Import a CSV or add a category to start budgeting.</p>
            </div>
          ) : (
            <ul className="cat-list">
              {lines.map((line) => (
                <BudgetRow
                  key={`${line.category_id ?? "none"}:${line.limit}`}
                  line={line}
                  onSave={(limit) =>
                    line.category_id !== null &&
                    saveBudget.mutate({ categoryId: line.category_id, limit })
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Transactions" className="tx-section">
          <h2>Transactions</h2>
          {transactions.data && transactions.data.length === 0 ? (
            <p className="muted">No transactions this month.</p>
          ) : (
            <div className="card tx-wrap">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactions.data ?? []).map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      categories={categories.data ?? []}
                      onChange={(value) => recategorize.mutate({ id: tx.id, value })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <aside className="bills-side">
        <ImportCard />
        <AddCategory />
      </aside>
    </div>
  );
}
