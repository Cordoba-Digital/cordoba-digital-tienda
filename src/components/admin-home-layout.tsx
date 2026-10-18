"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { defaultHomeLayout, HOME_BLOCKS, type HomeLayoutItem } from "@/lib/home-layout";

const INFO = new Map(HOME_BLOCKS.map((block) => [block.id, block]));

const btn =
  "grid h-8 w-8 place-items-center border border-ink-200 text-ink-700 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-100 disabled:cursor-default disabled:opacity-30";

/**
 * Lista de bloques de la home (subir, bajar, mostrar u ocultar) y la barra de
 * avisos de arriba del header, con un solo botón de guardar.
 */
export function AdminHomeLayout({ initial, initialTopBar }: { initial: HomeLayoutItem[]; initialTopBar: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [topBar, setTopBar] = useState(initialTopBar);
  const [saved, setSaved] = useState(JSON.stringify({ items: initial, topBar: initialTopBar }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify({ items, topBar }) !== saved;

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

  /** Vuelve al orden recomendado sin tocar qué bloques están ocultos. */
  function recommended() {
    setItems((current) =>
      defaultHomeLayout().map((block) => ({ ...block, visible: current.find((item) => item.id === block.id)?.visible ?? true })),
    );
    setMessage(null);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/home", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: items, topBar }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; blocks?: HomeLayoutItem[]; topBar?: boolean };
      if (!res.ok || !data.ok || !data.blocks) {
        setMessage({ ok: false, text: data.error ?? "No se pudo guardar." });
        return;
      }
      const savedTopBar = data.topBar ?? topBar;
      setItems(data.blocks);
      setTopBar(savedTopBar);
      setSaved(JSON.stringify({ items: data.blocks, topBar: savedTopBar }));
      setMessage({ ok: true, text: "Guardado. La tienda ya muestra estos cambios." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Error de red. Probá de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={`admin-table flex flex-wrap items-center gap-3 px-4 py-3 ${topBar ? "" : "bg-ink-50"}`}>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${topBar ? "text-ink-900" : "text-ink-400 line-through"}`}>Barra de avisos</p>
          <p className="text-xs text-ink-500">
            La franja naranja de arriba del header, con los mensajes de pagos, envíos, retiro y garantía. Se ve en todas las páginas.
            Si la ocultás, en el celular esos mensajes pasan a la portada.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-700">
          <input
            type="checkbox"
            checked={topBar}
            disabled={busy}
            onChange={() => {
              setTopBar((v) => !v);
              setMessage(null);
            }}
            className="h-4 w-4"
            aria-label="Mostrar la barra de avisos"
          />
          Mostrar
        </label>
      </div>
      <h2 className="pt-2 text-sm font-semibold text-ink-900">Bloques de la página principal</h2>
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
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={recommended}
          disabled={busy}
          className="h-10 border border-ink-200 px-4 text-sm font-bold text-ink-700 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-100 disabled:cursor-default disabled:opacity-50"
        >
          Usar el orden recomendado
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
