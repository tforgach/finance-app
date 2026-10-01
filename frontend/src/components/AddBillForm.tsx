import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { toISO } from "../lib/calendar";
import type { Frequency } from "../types";

const FREQUENCIES: Frequency[] = ["monthly", "weekly", "biweekly", "yearly"];

export function AddBillForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState(() => toISO(new Date()));
  const [autopay, setAutopay] = useState(false);

  const create = useMutation({
    mutationFn: api.createBill,
    onSuccess: () => {
      setName("");
      setAmount("");
      setAutopay(false);
      return queryClient.invalidateQueries();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name: name.trim(), amount, frequency, start_date: startDate, autopay });
  }

  return (
    <form className="card add-bill" onSubmit={submit}>
      <h2>Add a bill</h2>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      </label>
      <label>
        Amount
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <label>
        Repeats
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label>
        First due date
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={autopay} onChange={(e) => setAutopay(e.target.checked)} />
        Autopay
      </label>
      <button type="submit" disabled={create.isPending}>
        {create.isPending ? "Adding…" : "Add bill"}
      </button>
      {create.isError && <p className="error">Couldn't add the bill. Is the API running?</p>}
    </form>
  );
}
