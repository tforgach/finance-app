import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { cleanExtra, formatMonths, monthYearAfter, utilizationTone } from "../lib/debt";
import { formatMoney } from "../lib/format";
import { useDebounced } from "../lib/useDebounced";
import type { PayoffPlan } from "../types";
import { AddDebtForm } from "./AddDebtForm";

const PLAN_INFO = {
  avalanche: { title: "Avalanche", blurb: "Highest APR first. Pays the least interest." },
  snowball: { title: "Snowball", blurb: "Smallest balance first. Quick wins." },
} as const;

function PlanCard({ plan, best, now }: { plan: PayoffPlan; best: boolean; now: Date }) {
  const info = PLAN_INFO[plan.strategy];
  return (
    <section className={`card plan ${best ? "plan-best" : ""}`} aria-label={`${info.title} plan`}>
      <header>
        <h3>{info.title}</h3>
        {best && <span className="badge">Least interest</span>}
      </header>
      <p className="muted">{info.blurb}</p>
      <dl>
        <div>
          <dt>Debt-free in</dt>
          <dd>
            {plan.paid_off && plan.months !== null
              ? `${formatMonths(plan.months)} (${monthYearAfter(now, plan.months)})`
              : "Never at these payments"}
          </dd>
        </div>
        <div>
          <dt>Total interest</dt>
          <dd>{formatMoney(plan.total_interest)}</dd>
        </div>
      </dl>
      {plan.payoff_order.length > 0 && (
        <ol className="order">
          {plan.payoff_order.map((step) => (
            <li key={step.id}>
              {step.name} <span className="muted">paid off in {formatMonths(step.month)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function DebtCenter() {
  const queryClient = useQueryClient();
  const [now] = useState(() => new Date());
  const [extraInput, setExtraInput] = useState("0");
  const extra = cleanExtra(useDebounced(extraInput));

  const summary = useQuery({ queryKey: ["debts"], queryFn: api.debtSummary });
  const payoff = useQuery({
    queryKey: ["payoff", extra],
    queryFn: () => api.payoff(extra),
    placeholderData: keepPreviousData,
  });
  const remove = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const debts = summary.data?.debts ?? [];
  const plans = payoff.data;
  const avalancheBest =
    plans && Number(plans.avalanche.total_interest) < Number(plans.snowball.total_interest);

  return (
    <div className="bills">
      <div className="bills-main">
        <h2 className="page-title">Debt Center</h2>

        {summary.isError && (
          <p className="error">Can't reach the API. Is the backend running on port 8000?</p>
        )}

        <div className="stats stats-3">
          <div className="card stat">
            <span>Total debt</span>
            <strong>{formatMoney(summary.data?.total_debt ?? 0)}</strong>
          </div>
          <div className="card stat">
            <span>Minimum payments / mo</span>
            <strong>{formatMoney(summary.data?.total_min_payments ?? 0)}</strong>
          </div>
          <div className="card stat">
            <span>Interest accruing / mo</span>
            <strong>{formatMoney(summary.data?.estimated_monthly_interest ?? 0)}</strong>
          </div>
        </div>

        {summary.isSuccess && debts.length === 0 ? (
          <div className="card empty">
            <h2>No debts yet</h2>
            <p className="muted">Add a credit card or loan to see your payoff plan.</p>
          </div>
        ) : (
          <ul className="debt-list">
            {debts.map((debt) => (
              <li key={debt.id} className="card debt">
                <div className="debt-head">
                  <div>
                    <strong>{debt.name}</strong>
                    <span className="badge badge-quiet">
                      {debt.type === "credit_card" ? "Credit card" : "Loan"}
                    </span>
                  </div>
                  <strong className="debt-balance">{formatMoney(debt.balance)}</strong>
                </div>
                <div className="debt-meta">
                  <span>{debt.apr ? `${Number(debt.apr)}% APR` : "APR not set"}</span>
                  <span>
                    {debt.min_payment ? `${formatMoney(debt.min_payment)} min` : "No minimum set"}
                  </span>
                  <span>{formatMoney(debt.monthly_interest)} interest / mo</span>
                </div>
                {debt.utilization !== null && (
                  <div
                    className="meter"
                    role="meter"
                    aria-label={`${debt.name} utilization`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(debt.utilization, 100)}
                  >
                    <div
                      className={`meter-fill meter-${utilizationTone(debt.utilization)}`}
                      style={{ width: `${Math.min(debt.utilization, 100)}%` }}
                    />
                    <span>{debt.utilization}% utilization</span>
                  </div>
                )}
                <button
                  className="link-button"
                  onClick={() => {
                    if (window.confirm(`Remove ${debt.name}?`)) remove.mutate(debt.id);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {debts.length > 0 && (
          <section className="planner" aria-label="Payoff planner">
            <div className="planner-head">
              <h2>Payoff planner</h2>
              <label className="extra">
                Extra per month
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={extraInput}
                  onChange={(e) => setExtraInput(e.target.value)}
                />
              </label>
            </div>
            {payoff.isError && <p className="error">Couldn't calculate a payoff plan.</p>}
            {plans && (
              <>
                <div className="plans">
                  <PlanCard plan={plans.avalanche} best={!!avalancheBest} now={now} />
                  <PlanCard plan={plans.snowball} best={false} now={now} />
                </div>
                {plans.interest_saved_by_avalanche !== null &&
                  Number(plans.interest_saved_by_avalanche) > 0 && (
                    <p className="callout">
                      Avalanche saves you {formatMoney(plans.interest_saved_by_avalanche)} in
                      interest compared with snowball.
                    </p>
                  )}
              </>
            )}
          </section>
        )}
      </div>

      <aside className="bills-side">
        <AddDebtForm />
      </aside>
    </div>
  );
}
