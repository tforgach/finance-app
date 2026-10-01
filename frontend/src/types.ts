export type BillStatus = "paid" | "overdue" | "upcoming";
export type Frequency = "weekly" | "biweekly" | "monthly" | "yearly";

export interface CalendarEntry {
  bill_id: number;
  name: string;
  amount: string;
  due_date: string;
  autopay: boolean;
  status: BillStatus;
}

export interface BillCreate {
  name: string;
  amount: string;
  frequency: Frequency;
  start_date: string;
  autopay: boolean;
}

export interface Bill extends BillCreate {
  id: number;
  active: boolean;
  account_id: number | null;
}

export type AccountType = "checking" | "savings" | "credit_card" | "loan";

export interface DebtLine {
  id: number;
  name: string;
  type: AccountType;
  balance: string;
  apr: string | null;
  min_payment: string | null;
  utilization: number | null;
  monthly_interest: string;
}

export interface DebtSummary {
  total_debt: string;
  total_min_payments: string;
  estimated_monthly_interest: string;
  debts: DebtLine[];
}

export interface PayoffPlan {
  strategy: "avalanche" | "snowball";
  months: number | null;
  paid_off: boolean;
  total_interest: string;
  payoff_order: { id: number; name: string; month: number }[];
}

export interface PayoffCompare {
  extra_payment: string;
  avalanche: PayoffPlan;
  snowball: PayoffPlan;
  interest_saved_by_avalanche: string | null;
}

export interface DebtCreate {
  name: string;
  type: "credit_card" | "loan";
  balance: string;
  apr: string | null;
  min_payment: string | null;
  credit_limit: string | null;
  due_day: number | null;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  category_id: number | null;
  date: string;
  description: string;
  amount: string;
  is_transfer: boolean;
}

export interface BudgetLine {
  category_id: number | null;
  category: string;
  limit: string | null;
  spent: string;
  remaining: string | null;
  percent_used: number | null;
}

export interface BudgetSummary {
  month: string;
  total_limit: string;
  total_spent: string;
  lines: BudgetLine[];
}

export interface SpendingSummary {
  month: string;
  income: string;
  spending: string;
  net: string;
}

export interface ImportResult {
  imported: number;
  skipped_duplicates: number;
  errors: string[];
}

export interface TransactionUpdate {
  category_id: number | null;
  is_transfer: boolean;
}
