"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Batch = {
  ok: boolean;
  error?: string;
  products?: number;
  copied?: number;
  failed?: number;
  errors?: string[];
  remainingProducts?: number;
  failedProductIds?: number[];
};

export function AdminWpImagesCopy({
  store,
  pendingProducts,
  pendingImages,
}: {
  store: string | null;
  pendingProducts: number;
  pendingImages: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(0);
  const [failed, setFailed] = useState(0);
  const [remaining, setRemaining] = useState(pendingProducts);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const stop = useRef(false);

  async function run() {
    setRunning(true);
    setMessage(null);
    stop.current = false;
    const skip: number[] = [];
    try {
      for (;;) {
        if (stop.current) {
          setMessage("Pausado. Podés seguir cuando quieras.");
          break;
        }
        const res = await fetch("/api/admin/fotos-wp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skip }),
        });
        const data = (await res.json().catch(() => ({ ok: false, error: `Error ${res.status}` }))) as Batch;
        if (!data.ok) {
          setMessage(data.error ?? "No se pudo copiar.");
          break;
        }
        setCopied((n) => n + (data.copied ?? 0));
        setFailed((n) => n + (data.failed ?? 0));
        setRemaining(data.remainingProducts ?? 0);
        if (data.errors?.length) setErrors((prev) => [...prev, ...data.errors!].slice(-30));
        skip.push(...(data.failedProductIds ?? []));
        if (!data.products) {
          setMessage(
            data.remainingProducts
              ? `Terminó la pasada. ${data.remainingProducts} productos tienen fotos que no se pudieron copiar: podés reintentar.`
              : "Listo: todas las fotos ya están copiadas.",
          );
          break;
        }
      }
    } catch {
      setMessage("Se cortó la conexión. Volvé a tocar el botón para seguir desde donde quedó.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  if (!store) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        No hay almacenamiento de fotos configurado (Vercel Blob o Cloudflare R2).
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-ink-200 bg-surface p-5">
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-500">Destino</dt>
          <dd className="font-bold text-ink-900">{store}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Productos pendientes</dt>
          <dd className="font-bold text-ink-900">{remaining.toLocaleString("es-AR")}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Copiadas ahora</dt>
          <dd className="font-bold text-ink-900">{copied.toLocaleString("es-AR")}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Fallas</dt>
          <dd className="font-bold text-ink-900">{failed.toLocaleString("es-AR")}</dd>
        </div>
      </dl>
      {pendingImages > 0 && !running && copied === 0 ? (
        <p className="text-sm text-ink-500">
          Hay {pendingImages.toLocaleString("es-AR")} fotos por copiar. Dejá esta pestaña abierta mientras trabaja.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running || remaining === 0}
          className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? "Copiando…" : copied || failed ? "Seguir copiando" : "Copiar fotos del WordPress"}
        </button>
        {running ? (
          <button
            type="button"
            onClick={() => (stop.current = true)}
            className="rounded-xl border border-ink-300 px-4 py-2 text-sm font-bold text-ink-700 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:border-ink-500"
          >
            Pausar
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="text-sm font-semibold text-ink-900" role="status">
          {message}
        </p>
      ) : null}
      {errors.length ? (
        <details className="text-xs text-ink-500">
          <summary className="cursor-pointer">Fotos que no se pudieron copiar ({errors.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
