"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { PhotoCheckStatus } from "@/lib/photo-checks";

type Batch = {
  ok: boolean;
  error?: string;
  products?: number;
  measured?: number;
  failed?: number;
  failedProductIds?: number[];
  errors?: string[];
  remaining?: number;
};

const n = (value: number) => value.toLocaleString("es-AR");

/** Tarjeta con un número que lleva a la lista de productos ya filtrada. */
function Count({ href, label, value, hint }: { href: string; label: string; value: number; hint: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-ink-200 p-3 transition-[background-color,border-color] duration-150 hover:border-ink-400 hover:bg-adm-fg/[0.04]"
    >
      <span className="block text-sm text-ink-500">{label}</span>
      <span className="block text-2xl font-bold text-ink-900">{n(value)}</span>
      <span className="block text-xs text-ink-500">{hint}</span>
    </Link>
  );
}

export function AdminPhotoReview({ status, smallPx }: { status: PhotoCheckStatus; smallPx: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [measured, setMeasured] = useState(0);
  const [failed, setFailed] = useState(0);
  const [remaining, setRemaining] = useState(status.unmeasured);
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
        const res = await fetch("/api/admin/fotos-revision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skip }),
        });
        const data = (await res.json().catch(() => ({ ok: false, error: `Error ${res.status}` }))) as Batch;
        if (!data.ok) {
          setMessage(data.error ?? "No se pudieron medir las fotos.");
          break;
        }
        setMeasured((v) => v + (data.measured ?? 0));
        setFailed((v) => v + (data.failed ?? 0));
        setRemaining(data.remaining ?? 0);
        if (data.errors?.length) setErrors((prev) => [...prev, ...data.errors!].slice(-30));
        skip.push(...(data.failedProductIds ?? []));
        if (!data.products) {
          setMessage(
            skip.length
              ? `Listo. ${n(skip.length)} fotos no se pudieron medir: abajo está el detalle.`
              : "Listo: todas las fotos están medidas.",
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

  return (
    <div className="space-y-4 rounded-2xl border border-ink-200 bg-surface p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count href="/admin/productos?fotos=sin" label="Sin foto" value={status.noPhoto} hint="No muestran ninguna imagen" />
        <Count
          href="/admin/productos?fotos=chicas"
          label="Fotos chicas"
          value={status.small}
          hint={`Menos de ${n(smallPx)} px: se ven borrosas`}
        />
        <Count
          href="/admin/productos?fotos=marcadas"
          label="Marcadas para cambiar"
          value={status.flagged}
          hint="Las marcaste desde la lista"
        />
        <Count href="/admin/productos?fotos=sin-medir" label="Sin medir" value={remaining} hint="Todavía no se revisaron" />
      </div>

      <p className="text-sm text-ink-500">
        Medir revisa el tamaño de la foto principal de cada producto. La primera vez tarda unos minutos; después solo
        mide las fotos nuevas o cambiadas. Dejá esta pestaña abierta mientras trabaja.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running || remaining === 0}
          className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? `Midiendo… ${n(measured)}` : remaining === 0 ? "Todo medido" : measured || failed ? "Seguir midiendo" : "Medir fotos"}
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
          <summary className="cursor-pointer">Fotos que no se pudieron medir ({errors.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="text-sm text-ink-500">
        Las fotos que no corresponden al producto no se pueden detectar solas: tocá <strong>Marcar foto</strong> en la
        lista de productos cuando veas una, y después las encontrás todas juntas en <strong>Marcadas para cambiar</strong>. Al cambiar
        la foto principal desde Editar, la marca se saca sola.
      </p>
    </div>
  );
}
