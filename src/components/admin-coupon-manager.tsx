"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CouponRow } from "@/lib/admin-coupons";
import { money } from "@/lib/format";

type Form = {
  code: string;
  kind: "percent" | "fixed";
  value: string;
  minSubtotal: string;
  expiresOn: string;
  maxUses: string;
  description: string;
};

const EMPTY: Form = { code: "", kind: "percent", value: "", minSubtotal: "", expiresOn: "", maxUses: "", description: "" };

const STATE: Record<string, { label: string; cls: string }> = {
  ok: { label: "Activo", cls: "bg-emerald-700 text-white" },
  inactivo: { label: "Pausado", cls: "bg-ink-300 text-ink-900" },
  vencido: { label: "Vencido", cls: "bg-ink-700 text-white" },
  agotado: { label: "Agotado", cls: "bg-amber-500 text-ink-900" },
};

const inputCls =
  "h-10 w-full min-w-0 border border-ink-200 bg-surface px-3 text-sm text-ink-900 outline-none focus:border-ink-400";

function formFrom(row: CouponRow): Form {
  return {
    code: row.code,
    kind: row.kind,
    value: String(row.value),
    minSubtotal: row.minSubtotal ? String(row.minSubtotal) : "",
    expiresOn: row.expiresOn,
    maxUses: row.maxUses === null ? "" : String(row.maxUses),
    description: row.description,
  };
}

function discountLabel(row: CouponRow): string {
  return row.kind === "percent" ? `${row.value}%` : money(row.value);
}

function dateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function AdminCouponManager({ rows }: { rows: CouponRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function send(target: string, url: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<boolean> {
    setBusy(target);
    setError("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Error de red. Probá de nuevo.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = editing ? rows.find((r) => r.code === editing) : null;
    const body = { ...form, active: row ? row.active : true };
    const ok = editing
      ? await send(editing, `/api/admin/coupons/${encodeURIComponent(editing)}`, "PATCH", body)
      : await send("nuevo", "/api/admin/coupons", "POST", body);
    if (ok) {
      setForm(EMPTY);
      setEditing(null);
    }
  }

  function toggle(row: CouponRow) {
    void send(row.code, `/api/admin/coupons/${encodeURIComponent(row.code)}`, "PATCH", { ...formFrom(row), active: !row.active });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="admin-card space-y-3 p-4">
        <p className="text-sm font-bold text-ink-900">{editing ? `Editar ${editing}` : "Nuevo cupón"}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-semibold text-ink-600">
            Código
            <input
              className={`${inputCls} mt-1 uppercase`}
              value={form.code}
              onChange={set("code")}
              placeholder="BIENVENIDA"
              disabled={editing !== null}
              required
            />
          </label>
          <label className="block text-xs font-semibold text-ink-600">
            Tipo
            <select className={`${inputCls} mt-1`} value={form.kind} onChange={set("kind")}>
              <option value="percent">Porcentaje</option>
              <option value="fixed">Monto fijo</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink-600">
            {form.kind === "percent" ? "Descuento (%)" : "Descuento ($)"}
            <input className={`${inputCls} mt-1`} inputMode="numeric" value={form.value} onChange={set("value")} required />
          </label>
          <label className="block text-xs font-semibold text-ink-600">
            Compra mínima ($)
            <input className={`${inputCls} mt-1`} inputMode="numeric" value={form.minSubtotal} onChange={set("minSubtotal")} placeholder="Sin mínimo" />
          </label>
          <label className="block text-xs font-semibold text-ink-600">
            Vence (último día)
            <input className={`${inputCls} mt-1`} type="date" value={form.expiresOn} onChange={set("expiresOn")} />
          </label>
          <label className="block text-xs font-semibold text-ink-600">
            Tope de usos
            <input className={`${inputCls} mt-1`} inputMode="numeric" value={form.maxUses} onChange={set("maxUses")} placeholder="Sin tope" />
          </label>
          <label className="block text-xs font-semibold text-ink-600 sm:col-span-2">
            Texto que ve el cliente al aplicarlo
            <input className={`${inputCls} mt-1`} value={form.description} onChange={set("description")} placeholder="Ej: 10% off en tu primera compra" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy !== null}
            className="h-10 bg-ink-900 px-5 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-700 disabled:cursor-default disabled:bg-ink-300"
          >
            {busy === (editing ?? "nuevo") ? "Guardando…" : editing ? "Guardar cambios" : "Crear cupón"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
                setError("");
              }}
              className="h-10 border border-ink-300 px-5 text-sm font-bold text-ink-700 hover:border-ink-500"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="admin-table overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">Todavía no hay cupones.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                <th className="px-4 py-2 font-semibold">Código</th>
                <th className="px-4 py-2 font-semibold">Descuento</th>
                <th className="px-4 py-2 font-semibold">Vence</th>
                <th className="px-4 py-2 font-semibold">Usos</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = STATE[row.problem ?? "ok"];
                return (
                  <tr key={row.code} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink-900">{row.code}</p>
                      {row.description ? <p className="text-xs text-ink-500">{row.description}</p> : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-800">
                      {discountLabel(row)}
                      {row.minSubtotal ? <span className="block text-xs text-ink-500">desde {money(row.minSubtotal)}</span> : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-800">{row.expiresOn ? dateLabel(row.expiresOn) : "No vence"}</td>
                    <td className="px-4 py-3 tabular-nums text-ink-800">
                      {row.usedCount}
                      {row.maxUses !== null ? ` / ${row.maxUses}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-[11px] font-bold ${state.cls}`}>{state.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => {
                            setEditing(row.code);
                            setForm(formFrom(row));
                            setError("");
                          }}
                          className="border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-ink-500 disabled:cursor-default"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => toggle(row)}
                          className="border border-ink-900 px-3 py-1.5 text-xs font-bold text-ink-900 hover:bg-ink-900 hover:text-white disabled:cursor-default"
                        >
                          {busy === row.code ? "…" : row.active ? "Pausar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
