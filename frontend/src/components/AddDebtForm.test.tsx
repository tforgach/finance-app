import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { AddDebtForm } from "./AddDebtForm";

vi.mock("../api", () => ({ api: { createDebt: vi.fn() } }));

const mocked = vi.mocked(api);

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AddDebtForm />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.createDebt.mockResolvedValue({});
});

describe("AddDebtForm", () => {
  it("submits a credit card with its limit and leaves blank optionals null", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText("Name"), "  Chase Sapphire ");
    await userEvent.type(screen.getByLabelText("Balance owed"), "1250.50");
    await userEvent.type(screen.getByLabelText("APR (%)"), "22.9");
    await userEvent.type(screen.getByLabelText("Credit limit"), "6000");
    await userEvent.click(screen.getByRole("button", { name: "Add debt" }));

    await waitFor(() => expect(mocked.createDebt).toHaveBeenCalledTimes(1));
    expect(mocked.createDebt.mock.calls[0][0]).toEqual({
      name: "Chase Sapphire",
      type: "credit_card",
      balance: "1250.5",
      apr: "22.9",
      min_payment: null,
      credit_limit: "6000",
      due_day: null,
    });
  });

  it("hides the credit limit field and drops it for loans", async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText("Type"), "loan");
    expect(screen.queryByLabelText("Credit limit")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "Student loan");
    await userEvent.type(screen.getByLabelText("Balance owed"), "9000");
    await userEvent.type(screen.getByLabelText("Payment due day (1–31)"), "15");
    await userEvent.click(screen.getByRole("button", { name: "Add debt" }));

    await waitFor(() => expect(mocked.createDebt).toHaveBeenCalled());
    expect(mocked.createDebt.mock.calls[0][0]).toMatchObject({
      type: "loan",
      credit_limit: null,
      due_day: 15,
    });
  });
});
