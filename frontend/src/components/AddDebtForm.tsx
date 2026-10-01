import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { DebtCreate } from "../types";

export function AddDebtForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<DebtCreate["type"]>("credit_card");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minPayment, setMinPayment] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [dueDay, setDueDay] = useState("");

  const create = useMutation({
    mutationFn: api.createDebt,
    onSuccess: () => {
      setName("");
      setBalance("");
      setApr("");
      setMinPayment("");
      setCreditLimit("");
      setDueDay("");
      return queryClient.invalidateQueries();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({
      name: name.trim(),
      type,
      balance,
      apr: apr || null,
      min_payment: minPayment || null,
      credit_limit: type === "credit_card" && creditLimit ? creditLimit : null,
      due_day: dueDay ? Number(dueDay) : null,
    });
  }

  return (
    <form className="card add-bill" onSubmit={submit}>
      <h2>Add a debt</h2>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      </label>
      <label>
        Type
        <select value={type} onChange={(e) => setType(e.target.value as DebtCreate["type"])}>
          <option value="credit_card">Credit card</option>
          <option value="loan">Loan</option>
        </select>
      </label>
      <label>
        Balance owed
        <input
          type="number"
          min="0"
          step="0.01"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          required
        />
      </label>
      <label>
        APR (%)
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={apr}
          onChange={(e) => setApr(e.target.value)}
        />
      </label>
      <label>
        Minimum payment
        <input
          type="number"
          min="0"
          step="0.01"
          value={minPayment}
          onChange={(e) => setMinPayment(e.target.value)}
        />
      </label>
      {type === "credit_card" && (
        <label>
          Credit limit
          <input
            type="number"
            min="0"
            step="0.01"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
          />
        </label>
      )}
      <label>
        Payment due day (1–31)
        <input
          type="number"
          min="1"
          max="31"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
        />
      </label>
      <button type="submit" disabled={create.isPending}>
        {create.isPending ? "Adding…" : "Add debt"}
      </button>
      {create.isError && <p className="error">Couldn't add the debt. Is the API running?</p>}
    </form>
  );
}
