import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import type { CalendarEntry } from "../types";
import { BillsCalendar } from "./BillsCalendar";

vi.mock("../api", () => ({
  api: {
    calendar: vi.fn(),
    upcoming: vi.fn(),
    createBill: vi.fn(),
    markPaid: vi.fn(),
    markUnpaid: vi.fn(),
  },
}));

const mocked = vi.mocked(api);

const entries: CalendarEntry[] = [
  {
    bill_id: 1,
    name: "Rent",
    amount: "1500.00",
    due_date: "2026-10-01",
    autopay: false,
    status: "overdue",
  },
  {
    bill_id: 2,
    name: "Netflix",
    amount: "15.49",
    due_date: "2026-10-20",
    autopay: true,
    status: "paid",
  },
];

function renderCalendar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BillsCalendar initialDate={new Date(2026, 9, 15)} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.calendar.mockResolvedValue(entries);
  mocked.upcoming.mockResolvedValue([]);
  mocked.markPaid.mockResolvedValue(undefined);
  mocked.markUnpaid.mockResolvedValue(undefined);
});

describe("BillsCalendar", () => {
  it("loads the visible month and shows each bill on its due date", async () => {
    renderCalendar();
    expect(await screen.findByRole("button", { name: /Rent.*overdue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Netflix.*paid/i })).toBeInTheDocument();
    expect(mocked.calendar).toHaveBeenCalledWith("2026-10");
  });

  it("marks an overdue bill paid when its chip is clicked", async () => {
    renderCalendar();
    await userEvent.click(await screen.findByRole("button", { name: /Rent.*overdue/i }));
    await waitFor(() => expect(mocked.markPaid).toHaveBeenCalledWith(1, "2026-10-01"));
  });

  it("marks a paid bill unpaid when its chip is clicked", async () => {
    renderCalendar();
    await userEvent.click(await screen.findByRole("button", { name: /Netflix.*paid/i }));
    await waitFor(() => expect(mocked.markUnpaid).toHaveBeenCalledWith(2, "2026-10-20"));
  });

  it("requests the next month when navigating forward", async () => {
    renderCalendar();
    await userEvent.click(await screen.findByRole("button", { name: /Next/ }));
    await waitFor(() => expect(mocked.calendar).toHaveBeenCalledWith("2026-11"));
  });

  it("explains when the API is unreachable", async () => {
    mocked.calendar.mockRejectedValue(new Error("network"));
    renderCalendar();
    expect(await screen.findByText(/Can't reach the API/)).toBeInTheDocument();
  });
});
