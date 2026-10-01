import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./App.css";
import { BillsCalendar } from "./components/BillsCalendar";
import { BudgetPage } from "./components/BudgetPage";
import { DebtCenter } from "./components/DebtCenter";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 15_000 } },
});

const TABS = [
  { id: "bills", label: "Bills" },
  { id: "debts", label: "Debts" },
  { id: "budget", label: "Budget" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function tabFromHash(): Tab {
  return TABS.find((tab) => `#${tab.id}` === window.location.hash)?.id ?? "bills";
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);

  function select(next: Tab) {
    window.history.replaceState(null, "", `#${next}`);
    setTab(next);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <header className="app-header">
        <h1>Finance App</h1>
        <nav aria-label="Sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              className="nav-link"
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => select(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === "bills" && <BillsCalendar />}
        {tab === "debts" && <DebtCenter />}
        {tab === "budget" && <BudgetPage />}
      </main>
    </QueryClientProvider>
  );
}
