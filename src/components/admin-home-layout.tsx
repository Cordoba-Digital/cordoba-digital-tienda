"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { HOME_BLOCKS, type HomeLayoutItem } from "@/lib/home-layout";

const INFO = new Map(HOME_BLOCKS.map((block) => [block.id, block]));

const btn =
  "grid h-8 w-8 place-items-center border border-ink-200 text-ink-700 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-100 disabled:cursor-default disabled:opacity-30";

/** Lista de bloques de la home: subir, bajar, mostrar u ocultar, y guardar. */
export function AdminHomeLayout({ initial }: { initial: HomeLayoutItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(items) !== saved;

  function move(index: number, delta: number) {
    setItems((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
    setMessage(null);
  }

  function toggle(index: number) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, visible: !item.visible } : item)));
    setMessage(null);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/home", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: items }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; blocks?: HomeLayoutItem[] };
      if (!res.ok || !data.ok || !data.blocks) {
        setMessage({ ok: false, text: data.error ?? "No se pudo guardar." });
        return;
      }
      setItems(data.blocks);
      setSaved(JSON.stringify(data.blocks));
      setMessage({ ok: true, text: "Guardado. La home ya muestra este orden." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Error de red. Probá de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ol className="admin-table">
        {items.map((item, index) => {
          const info = INFO.get(item.id);
          const fixed = info && "fixed" in info && info.fixed;
          return (
            <li
              key={item.id}
              className={`flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-3 last:border-0 ${item.visible ? "" : "bg-ink-50"}`}
            >
              <span className="w-6 text-center text-sm font-black tabular-nums text-ink-400">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${item.visible ? "text-ink-900" : "text-ink-400 line-through"}`}>{info?.label}</p>
                <p className="text-xs text-ink-500">{info?.description}</p>
              </div>
              {fixed ? (
                <span className="text-xs font-semibold text-ink-400">Fijo</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button type="button" className={btn} disabled={busy || index <= 1} onClick={() => move(index, -1)} aria-label={`Subir ${info?.label}`}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={busy || index === items.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Bajar ${info?.label}`}
                  >
                    ↓
                  </button>
                  <label className="ml-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-700">
                    <input type="checkbox" checked={item.visible} disabled={busy} onChange={() => toggle(index)} className="h-4 w-4" aria-label={`Mostrar ${info?.label}`} />
                    Mostrar
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="h-10 bg-ink-900 px-5 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-700 disabled:cursor-default disabled:bg-ink-300"
        >
          {busy ? "Guardando…" : "Guardar orden"}
        </button>
        <a href="/" target="_blank" rel="noreferrer" className="text-sm font-bold text-brand-700 hover:text-brand-800">
          Ver la home
        </a>
        {message ? (
          <p role={message.ok ? "status" : "alert"} className={`text-sm font-semibold ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
