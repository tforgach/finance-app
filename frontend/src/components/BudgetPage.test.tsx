import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import type { BudgetSummary } from "../types";
import { BudgetPage } from "./BudgetPage";

vi.mock("../api", () => ({
  api: {
    budgetSummary: vi.fn(),
    spendingSummary: vi.fn(),
    transactions: vi.fn(),
    categories: vi.fn(),
    accounts: vi.fn(),
    setBudget: vi.fn(),
    deleteBudget: vi.fn(),
    updateTransaction: vi.fn(),
    importCsv: vi.fn(),
    createCategory: vi.fn(),
    createAccount: vi.fn(),
  },
}));

const mocked = vi.mocked(api);

const budget: BudgetSummary = {
  month: "2026-10",
  total_limit: "600.00",
  total_spent: "545.00",
  lines: [
    {
      category_id: 1,
      category: "Groceries",
      limit: "400.00",
      spent: "425.00",
      remaining: "-25.00",
      percent_used: 106.3,
    },
    {
      category_id: 2,
      category: "Dining",
      limit: "200.00",
      spent: "90.00",
      remaining: "110.00",
      percent_used: 45,
    },
    {
      category_id: null,
      category: "Uncategorized",
      limit: null,
      spent: "30.00",
      remaining: null,
      percent_used: null,
    },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BudgetPage initialDate={new Date(2026, 9, 15)} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.budgetSummary.mockResolvedValue(budget);
  mocked.spendingSummary.mockResolvedValue({
    month: "2026-10",
    income: "3000.00",
    spending: "545.00",
    net: "2455.00",
  });
  mocked.transactions.mockResolvedValue([
    {
      id: 11,
      account_id: 5,
      category_id: 1,
      date: "2026-10-03",
      description: "Trader Joe's",
      amount: "-85.50",
      is_transfer: false,
    },
    {
      id: 12,
      account_id: 5,
      category_id: null,
      date: "2026-10-04",
      description: "Card payment",
      amount: "-500.00",
      is_transfer: true,
    },
  ]);
  mocked.categories.mockResolvedValue([
    { id: 1, name: "Groceries" },
    { id: 2, name: "Dining" },
  ]);
  mocked.accounts.mockResolvedValue([{ id: 5, name: "Checking", type: "checking", balance: "0" }]);
  mocked.setBudget.mockResolvedValue(undefined);
  mocked.deleteBudget.mockResolvedValue(undefined);
  mocked.updateTransaction.mockResolvedValue({} as never);
});

describe("BudgetPage categories", () => {
  it("shows month totals and each category's progress", async () => {
    renderPage();
    expect(await screen.findByText("$25.00 over")).toBeInTheDocument();
    expect(screen.getByText("$110.00 left")).toBeInTheDocument();
    expect(screen.getByText("No budget set")).toBeInTheDocument();
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: /Groceries budget used/ })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.queryByLabelText(/Uncategorized monthly budget/)).not.toBeInTheDocument();
  });

  it("saves a new limit when Enter is pressed", async () => {
    renderPage();
    const input = await screen.findByLabelText(/Dining monthly budget/);
    await userEvent.clear(input);
    await userEvent.type(input, "250{Enter}");
    await waitFor(() => expect(mocked.setBudget).toHaveBeenCalledWith(2, "250"));
  });

  it("removes the budget when the limit is cleared", async () => {
    renderPage();
    const input = await screen.findByLabelText(/Dining monthly budget/);
    await userEvent.clear(input);
    await userEvent.tab();
    await waitFor(() => expect(mocked.deleteBudget).toHaveBeenCalledWith(2));
  });

  it("does nothing when the limit is unchanged", async () => {
    renderPage();
    const input = await screen.findByLabelText(/Dining monthly budget/);
    await userEvent.click(input);
    await userEvent.tab();
    expect(mocked.setBudget).not.toHaveBeenCalled();
    expect(mocked.deleteBudget).not.toHaveBeenCalled();
  });

  it("shows an empty state when there is nothing to budget", async () => {
    mocked.budgetSummary.mockResolvedValue({ ...budget, lines: [] });
    renderPage();
    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
  });
});

describe("BudgetPage transactions", () => {
  it("recategorizes a transaction", async () => {
    renderPage();
    const select = await screen.findByLabelText("Category for Trader Joe's");
    await userEvent.selectOptions(select, "Dining");
    await waitFor(() =>
      expect(mocked.updateTransaction).toHaveBeenCalledWith(11, {
        category_id: 2,
        is_transfer: false,
      }),
    );
  });

  it("marks a transaction as a transfer", async () => {
    renderPage();
    const select = await screen.findByLabelText("Category for Trader Joe's");
    await userEvent.selectOptions(select, "Transfer (not spending)");
    await waitFor(() =>
      expect(mocked.updateTransaction).toHaveBeenCalledWith(11, {
        category_id: null,
        is_transfer: true,
      }),
    );
  });

  it("shows existing transfers as transfers", async () => {
    renderPage();
    const select = await screen.findByLabelText("Category for Card payment");
    expect(select).toHaveValue("transfer");
  });
});

describe("BudgetPage navigation and import", () => {
  it("loads the next month", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Next/ }));
    await waitFor(() => expect(mocked.budgetSummary).toHaveBeenCalledWith("2026-11"));
    expect(mocked.transactions).toHaveBeenCalledWith("2026-11-01", "2026-11-30");
  });

  it("uploads a CSV for the selected account and reports the result", async () => {
    mocked.importCsv.mockResolvedValue({ imported: 3, skipped_duplicates: 1, errors: [] });
    renderPage();
    const card = (await screen.findByRole("heading", { name: "Import transactions" })).closest(
      ".card",
    ) as HTMLElement;
    const file = new File(["date,description,amount\n"], "bank.csv", { type: "text/csv" });

    await userEvent.upload(await within(card).findByLabelText("CSV file"), file);
    await userEvent.click(within(card).getByRole("button", { name: "Import" }));

    await waitFor(() => expect(mocked.importCsv).toHaveBeenCalledWith(5, file));
    expect(await within(card).findByRole("status")).toHaveTextContent(
      "Imported 3, skipped 1 duplicates",
    );
  });

  it("asks for an account before importing when none exist", async () => {
    mocked.accounts.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/Add an account first/)).toBeInTheDocument();
  });
});
