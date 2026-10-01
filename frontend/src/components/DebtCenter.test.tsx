import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import type { DebtSummary, PayoffCompare, PayoffPlan } from "../types";
import { DebtCenter } from "./DebtCenter";

vi.mock("../api", () => ({
  api: {
    debtSummary: vi.fn(),
    payoff: vi.fn(),
    createDebt: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));

const mocked = vi.mocked(api);

const summary: DebtSummary = {
  total_debt: "7000.00",
  total_min_payments: "210.00",
  estimated_monthly_interest: "93.33",
  debts: [
    {
      id: 1,
      name: "Visa",
      type: "credit_card",
      balance: "2000.00",
      apr: "24.00",
      min_payment: "60.00",
      utilization: 25,
      monthly_interest: "40.00",
    },
    {
      id: 2,
      name: "Car loan",
      type: "loan",
      balance: "5000.00",
      apr: "8.00",
      min_payment: "150.00",
      utilization: null,
      monthly_interest: "33.33",
    },
  ],
};

const plan = (strategy: PayoffPlan["strategy"], interest: string, months: number | null) =>
  ({
    strategy,
    months,
    paid_off: months !== null,
    total_interest: interest,
    payoff_order: months === null ? [] : [{ id: 1, name: "Visa", month: 9 }],
  }) satisfies PayoffPlan;

const compare: PayoffCompare = {
  extra_payment: "0",
  avalanche: plan("avalanche", "900.00", 30),
  snowball: plan("snowball", "1000.00", 31),
  interest_saved_by_avalanche: "100.00",
};

function renderCenter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DebtCenter />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.debtSummary.mockResolvedValue(summary);
  mocked.payoff.mockResolvedValue(compare);
});

describe("DebtCenter", () => {
  it("lists each debt with its terms and credit-card utilization", async () => {
    renderCenter();
    expect(await screen.findByText("Car loan")).toBeInTheDocument();
    expect(screen.getAllByText("Visa").length).toBeGreaterThan(0);
    expect(screen.getByText("$7,000.00")).toBeInTheDocument();
    expect(screen.getByText("24% APR")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: /Visa utilization/ })).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
    expect(screen.queryByRole("meter", { name: /Car loan/ })).not.toBeInTheDocument();
  });

  it("compares both payoff strategies and the interest avalanche saves", async () => {
    renderCenter();
    const avalanche = await screen.findByRole("region", { name: "Avalanche plan" });
    expect(within(avalanche).getByText("Least interest")).toBeInTheDocument();
    expect(within(avalanche).getByText("$900.00")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Snowball plan" })).toBeInTheDocument();
    expect(screen.getByText(/Avalanche saves you \$100\.00/)).toBeInTheDocument();
  });

  it("recalculates when an extra monthly payment is entered", async () => {
    renderCenter();
    const input = await screen.findByLabelText("Extra per month");
    await userEvent.clear(input);
    await userEvent.type(input, "100");
    await waitFor(() => expect(mocked.payoff).toHaveBeenCalledWith("100"));
  });

  it("warns when a plan never pays the debt off", async () => {
    mocked.payoff.mockResolvedValue({
      ...compare,
      avalanche: plan("avalanche", "50000.00", null),
      snowball: plan("snowball", "50000.00", null),
      interest_saved_by_avalanche: null,
    });
    renderCenter();
    const avalanche = await screen.findByRole("region", { name: "Avalanche plan" });
    expect(within(avalanche).getByText("Never at these payments")).toBeInTheDocument();
  });

  it("shows an empty state and hides the planner when there are no debts", async () => {
    mocked.debtSummary.mockResolvedValue({
      total_debt: "0",
      total_min_payments: "0",
      estimated_monthly_interest: "0",
      debts: [],
    });
    renderCenter();
    expect(await screen.findByText("No debts yet")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Payoff planner" })).not.toBeInTheDocument();
  });
});
