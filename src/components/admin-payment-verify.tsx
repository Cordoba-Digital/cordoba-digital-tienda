"use client";

import { useState } from "react";

import { money } from "@/lib/format";

type VerifyState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; mpStatus: string; mpAmount: number | null; matches: boolean | null };

const MP_STATUS_LABEL: Record<string, string> = {
  approved: "Aprobado",
  pending: "Pendiente",
  in_process: "En proceso",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Devuelto",
};

export function AdminPaymentVerify({ code }: { code: string }) {
  const [state, setState] = useState<VerifyState>({ kind: "idle" });

  async function verify() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        mpStatus?: string;
        mpAmount?: number | null;
        matches?: boolean | null;
      };
      if (!data.ok) {
        setState({ kind: "error", message: data.error ?? "No se pudo verificar." });
        return;
      }
      setState({
        kind: "done",
        mpStatus: data.mpStatus ?? "desconocido",
        mpAmount: data.mpAmount ?? null,
        matches: data.matches ?? null,
      });
    } catch {
      setState({ kind: "error", message: "Error de red. Probá de nuevo." });
    }
  }

  if (state.kind === "done") {
    return (
      <span className="text-xs">
        <span className="font-bold text-ink-800">{MP_STATUS_LABEL[state.mpStatus] ?? state.mpStatus}</span>
        {state.mpAmount !== null && <span className="text-ink-500"> · {money(state.mpAmount)}</span>}{" "}
        {state.matches === true && <span className="font-bold text-green-700">· coincide</span>}
        {state.matches === false && (
          <span className="font-bold text-red-700" role="alert">
            · NO coincide
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={verify}
        disabled={state.kind === "loading"}
        className="rounded-lg border border-ink-200 px-2 py-1 text-xs font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
      >
        {state.kind === "loading" ? "Verificando…" : "Verificar en MP"}
      </button>
      {state.kind === "error" && (
        <span className="text-xs text-red-700" role="alert">
          {state.message}
        </span>
      )}
    </span>
  );
}
