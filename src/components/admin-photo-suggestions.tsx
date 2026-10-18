"use client";

import Link from "next/link";
import { useState } from "react";

import { ProductImg } from "@/components/product-img";
import type { PendingSuggestion } from "@/lib/photo-suggestions";

const PAGE = 20;

function SuggestedPhoto({ src, alt }: { src: string; alt: string }) {
  const [size, setSize] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  return (
    <figure className="space-y-1">
      <div className="aspect-square overflow-hidden rounded-lg border border-ink-200 bg-white">
        {broken ? (
          <p className="grid h-full place-items-center p-2 text-center text-xs text-ink-500">No se pudo ver la foto</p>
        ) : (
          // Foto de otro sitio: se muestra tal cual, sin el optimizador de Vercel.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
            onLoad={(e) => setSize(`${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`)}
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <figcaption className="text-xs text-ink-500">Sugerida{size ? ` · ${size}` : ""}</figcaption>
    </figure>
  );
}

function Card({ item, onDone }: { item: PendingSuggestion; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState<"usar" | "descartar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "usar" | "descartar") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/fotos-sugeridas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.productSlug, image: item.image, action }),
      });
      const data = (await res.json().catch(() => ({ ok: false, error: `Error ${res.status}` }))) as {
        ok: boolean;
        error?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "No se pudo guardar.");
        return;
      }
      onDone(action === "usar" ? `Listo: ${item.name} ya tiene la foto nueva.` : `Descartada la sugerencia de ${item.name}.`);
    } catch {
      setError("Se cortó la conexión. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="space-y-3 rounded-xl border border-ink-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={`/admin/productos/${item.productSlug}`} className="font-semibold text-ink-900 hover:underline">
          {item.name}
        </Link>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            item.confidence === "alta" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {item.confidence === "alta" ? "Foto oficial" : "Revisar modelo o color"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <figure className="space-y-1">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-ink-200 bg-white">
            {item.currentImage ? (
              <ProductImg src={item.currentImage} alt="" sizes="200px" className="h-full w-full object-contain" />
            ) : (
              <p className="grid h-full place-items-center text-xs text-ink-500">Sin foto</p>
            )}
          </div>
          <figcaption className="text-xs text-ink-500">Actual</figcaption>
        </figure>
        <SuggestedPhoto src={item.image} alt={`Foto sugerida de ${item.name}`} />
      </div>
      {item.note ? <p className="text-xs text-ink-500">{item.note}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => decide("usar")}
          disabled={busy !== null}
          className="rounded-xl bg-brand-700 px-3 py-1.5 text-sm font-bold text-white transition-[background-color,opacity] duration-150 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "usar" ? "Guardando…" : "Usar esta foto"}
        </button>
        <button
          type="button"
          onClick={() => decide("descartar")}
          disabled={busy !== null}
          className="rounded-xl border border-ink-300 px-3 py-1.5 text-sm font-bold text-ink-700 transition-[border-color,opacity] duration-150 hover:border-ink-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "descartar" ? "Guardando…" : "Descartar"}
        </button>
        <a href={item.source} target="_blank" rel="noreferrer noopener" className="text-sm text-ink-500 underline">
          Ver de dónde sale
        </a>
      </div>
      {error ? (
        <p className="text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function AdminPhotoSuggestions({ items }: { items: PendingSuggestion[] }) {
  const [pending, setPending] = useState(items);
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  if (!pending.length) {
    return <p className="text-sm text-ink-500">{message ?? "No quedan fotos sugeridas para revisar."}</p>;
  }
  return (
    <div className="space-y-4">
      {message ? (
        <p className="text-sm font-semibold text-ink-900" role="status">
          {message}
        </p>
      ) : null}
      <ul className="grid gap-4 md:grid-cols-2">
        {pending.slice(0, shown).map((item) => (
          <Card
            key={`${item.productId} ${item.image}`}
            item={item}
            onDone={(text) => {
              setMessage(text);
              setPending((list) => list.filter((p) => p !== item));
            }}
          />
        ))}
      </ul>
      {pending.length > shown ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="rounded-xl border border-ink-300 px-4 py-2 text-sm font-bold text-ink-700 hover:border-ink-500"
        >
          Ver más ({pending.length - shown})
        </button>
      ) : null}
    </div>
  );
}
