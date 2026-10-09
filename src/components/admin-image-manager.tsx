"use client";

import { useState } from "react";

const MAX_IMAGES = 8;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Fotos del producto: la primera es la principal. Hoy se cargan por URL; para
 * subir archivos (Vercel Blob) alcanza con pasar `upload`, que recibe el
 * archivo y devuelve la URL pública: el resto del manejo no cambia.
 */
export function AdminImageManager({
  images,
  onChange,
  upload,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  upload?: (file: File) => Promise<string>;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const room = MAX_IMAGES - images.length;

  function add(urls: string[]) {
    setError("");
    const clean = urls.map((u) => u.trim()).filter(Boolean);
    const invalid = clean.filter((u) => !isHttpUrl(u));
    const fresh = clean.filter((u) => isHttpUrl(u) && !images.includes(u));
    if (invalid.length) setError("Algunas líneas no son URLs http(s) y se ignoraron.");
    if (fresh.length > room) setError(`Máximo ${MAX_IMAGES} fotos: se agregaron las primeras ${room}.`);
    if (fresh.length) onChange([...images, ...fresh.slice(0, Math.max(0, room))]);
  }

  async function onFiles(files: FileList | null) {
    if (!upload || !files?.length) return;
    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, room)) urls.push(await upload(file));
      add(urls);
    } catch {
      setError("No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  const btn = "rounded-md border border-ink-200 bg-surface px-2 py-1 text-[11px] font-bold text-ink-700 transition hover:border-ink-400 disabled:opacity-30";

  return (
    <div className="space-y-4">
      {images.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((url, index) => (
            <li
              key={url}
              draggable
              onDragStart={() => setDragFrom(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null) onChange(move(images, dragFrom, index));
                setDragFrom(null);
              }}
              onDragEnd={() => setDragFrom(null)}
              className={`group overflow-hidden rounded-xl border bg-surface ${
                index === 0 ? "border-ink-900" : "border-ink-100"
              } ${dragFrom === index ? "opacity-40" : ""}`}
            >
              <div className="relative aspect-square cursor-grab bg-white active:cursor-grabbing">
                {broken[url] ? (
                  <div className="grid h-full place-items-center p-3 text-center text-xs font-semibold text-rose-600">
                    La imagen no carga. Revisá la URL.
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setBroken((prev) => ({ ...prev, [url]: true }))}
                    className="h-full w-full object-contain p-2"
                  />
                )}
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-ink-900 px-2 py-0.5 text-[10px] font-bold text-white">
                    Principal
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 border-t border-ink-100 p-1.5">
                <div className="flex gap-1">
                  <button type="button" onClick={() => onChange(move(images, index, index - 1))} disabled={index === 0} aria-label="Mover a la izquierda" className={btn}>
                    ←
                  </button>
                  <button type="button" onClick={() => onChange(move(images, index, index + 1))} disabled={index === images.length - 1} aria-label="Mover a la derecha" className={btn}>
                    →
                  </button>
                </div>
                {index > 0 ? (
                  <button type="button" onClick={() => onChange(move(images, index, 0))} className={btn}>
                    Principal
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                  aria-label={`Quitar foto ${index + 1}`}
                  className={`${btn} hover:border-rose-300 hover:text-rose-600`}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
          Todavía no hay fotos. La primera que agregues va a ser la principal.
        </p>
      )}

      {room > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  add(draft.split(/\s+/));
                  setDraft("");
                }
              }}
              rows={1}
              placeholder="Pegá una o varias URLs de fotos (una por línea) y tocá Agregar"
              aria-label="URLs de fotos"
              className="min-h-10 w-full resize-y rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-400"
            />
            <button
              type="button"
              onClick={() => {
                add(draft.split(/\s+/));
                setDraft("");
              }}
              disabled={!draft.trim()}
              className="shrink-0 rounded-lg bg-ink-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Agregar
            </button>
            {upload ? (
              <label className="shrink-0 cursor-pointer rounded-lg border border-ink-200 px-4 py-2 text-center text-sm font-bold text-ink-700">
                {uploading ? "Subiendo…" : "Subir archivo"}
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void onFiles(e.target.files)} />
              </label>
            ) : null}
          </div>
          <p className="text-xs text-ink-500">
            {images.length}/{MAX_IMAGES} fotos. Arrastrá para reordenar.
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-500">Llegaste al máximo de {MAX_IMAGES} fotos.</p>
      )}
      {error ? <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}
