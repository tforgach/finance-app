import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

function AddAccount() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<"checking" | "savings">("checking");

  const create = useMutation({
    mutationFn: api.createAccount,
    onSuccess: () => {
      setName("");
      return queryClient.invalidateQueries();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name: name.trim(), type, balance: "0" });
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input
        aria-label="New account name"
        placeholder="Account name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <select
        aria-label="New account type"
        value={type}
        onChange={(e) => setType(e.target.value as "checking" | "savings")}
      >
        <option value="checking">Checking</option>
        <option value="savings">Savings</option>
      </select>
      <button type="submit" disabled={create.isPending}>
        Add account
      </button>
    </form>
  );
}

export function ImportCard() {
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: api.accounts });
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const isDebt = (type: string) => type === "credit_card" || type === "loan";
  const list = [...(accounts.data ?? [])].sort(
    (a, b) => Number(isDebt(a.type)) - Number(isDebt(b.type)),
  );
  const selected = accountId || (list[0] ? String(list[0].id) : "");

  const upload = useMutation({
    mutationFn: ({ id, csv }: { id: number; csv: File }) => api.importCsv(id, csv),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (file && selected) upload.mutate({ id: Number(selected), csv: file });
  }

  return (
    <div className="card import">
      <h2>Import transactions</h2>
      {accounts.isPending ? (
        <p className="muted">Loading accounts…</p>
      ) : list.length === 0 ? (
        <p className="muted">Add an account first, then import a CSV from your bank.</p>
      ) : (
        <form onSubmit={submit}>
          <label>
            Account
            <select value={selected} onChange={(e) => setAccountId(e.target.value)}>
              {list.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button type="submit" disabled={!file || upload.isPending}>
            {upload.isPending ? "Importing…" : "Import"}
          </button>
          <p className="muted small">
            Columns: date, description, amount (negative = spending), optional category. Use the
            category "Transfer" for card payments and account moves.
          </p>
        </form>
      )}
      {upload.isSuccess && (
        <div className="import-result" role="status">
          Imported {upload.data.imported}
          {upload.data.skipped_duplicates > 0 && `, skipped ${upload.data.skipped_duplicates} duplicates`}
          {upload.data.errors.length > 0 && (
            <ul>
              {upload.data.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {upload.isError && <p className="error">Import failed. Check the file and try again.</p>}
      <details>
        <summary>Add an account</summary>
        <AddAccount />
      </details>
    </div>
  );
}
