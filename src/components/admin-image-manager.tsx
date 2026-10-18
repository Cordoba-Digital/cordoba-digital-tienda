"use client";

import { useEffect, useRef, useState } from "react";

import { importProductImage, uploadProductImage } from "@/lib/prepare-image";

const MAX_IMAGES = 8;

function isOwnImage(value: string): boolean {
  return /^\/(api\/)?imagenes\/[a-z0-9-]*[a-f0-9]{24}\.[a-z]+$/.test(value);
}

function isExternalUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function isImageUrl(value: string): boolean {
  return isExternalUrl(value) || isOwnImage(value);
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function imageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(f.name));
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Fotos del producto: la primera es la principal. Se agregan subiendo
 * archivos, arrastrándolos, pegándolos con Ctrl+V (en cualquier parte de la
 * ficha) o con su URL. Siempre se guarda una copia propia, con el nombre del
 * producto en el archivo; si una foto de otra web no se puede descargar, queda
 * el link y se avisa. `upload`/`importUrl` permiten cambiar dónde se guardan
 * (por ejemplo Vercel Blob) sin tocar el resto.
 */
export function AdminImageManager({
  images,
  onChange,
  productName = "",
  upload = uploadProductImage,
  importUrl = importProductImage,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  productName?: string;
  upload?: (file: File, productName: string) => Promise<string>;
  importUrl?: (url: string, productName: string) => Promise<string>;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [pending, setPending] = useState(0);
  const [urlOpen, setUrlOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // La lista cambia mientras se suben varias fotos: siempre leemos la última.
  const latest = useRef({ images, onChange, productName });
  useEffect(() => {
    latest.current = { images, onChange, productName };
  });

  const room = MAX_IMAGES - images.length;

  function add(urls: string[]) {
    setError("");
    const current = latest.current.images;
    const free = MAX_IMAGES - current.length;
    const clean = urls.map((u) => u.trim()).filter(Boolean);
    const invalid = clean.filter((u) => !isImageUrl(u));
    const fresh = [...new Set(clean.filter((u) => isImageUrl(u) && !current.includes(u)))];
    if (invalid.length) setError("Algunas líneas no son URLs http(s) y se ignoraron.");
    if (fresh.length > free) setError(`Máximo ${MAX_IMAGES} fotos: se agregaron las primeras ${free}.`);
    if (fresh.length && free > 0) {
      const next = [...current, ...fresh.slice(0, free)];
      latest.current = { ...latest.current, images: next };
      latest.current.onChange(next);
    }
  }

  async function onFiles(list: FileList | File[] | null | undefined) {
    const files = imageFiles(list);
    if (!files.length) {
      if (list && Array.from(list).length) setError("Eso no es una foto.");
      return;
    }
    const free = MAX_IMAGES - latest.current.images.length - pending;
    if (free <= 0) {
      setError(`Llegaste al máximo de ${MAX_IMAGES} fotos.`);
      return;
    }
    const batch = files.slice(0, free);
    setError(files.length > free ? `Máximo ${MAX_IMAGES} fotos: se suben las primeras ${free}.` : "");
    setPending((n) => n + batch.length);
    const failures: string[] = [];
    for (const file of batch) {
      try {
        add([await upload(file, latest.current.productName)]);
      } catch (e) {
        failures.push(`${file.name || "foto"}: ${e instanceof Error ? e.message : "no se pudo subir"}`);
      } finally {
        setPending((n) => n - 1);
      }
    }
    if (failures.length) setError(failures.join(" · "));
  }

  /** Fotos de otra web: se descarga una copia; si no se puede, queda el link. */
  async function addExternal(urls: string[]) {
    const clean = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
    const own = clean.filter(isOwnImage);
    if (own.length) add(own);
    const external = clean.filter((u) => isExternalUrl(u) && !latest.current.images.includes(u));
    if (clean.some((u) => !isImageUrl(u))) setError("Algunas líneas no son URLs http(s) y se ignoraron.");
    const free = MAX_IMAGES - latest.current.images.length - pending;
    if (!external.length) return;
    if (free <= 0) {
      setError(`Llegaste al máximo de ${MAX_IMAGES} fotos.`);
      return;
    }
    const batch = external.slice(0, free);
    setPending((n) => n + batch.length);
    const kept: string[] = [];
    for (const url of batch) {
      try {
        add([await importUrl(url, latest.current.productName)]);
      } catch {
        add([url]);
        kept.push(url);
      } finally {
        setPending((n) => n - 1);
      }
    }
    if (kept.length) {
      setError(
        `${kept.length === 1 ? "Una foto no se pudo copiar y quedó" : `${kept.length} fotos no se pudieron copiar y quedaron`} como link a la otra web: si esa web la borra, se rompe. Mejor descargala y subila.`,
      );
    }
  }

  // Ctrl+V con una foto copiada, en cualquier parte de la ficha.
  const onFilesRef = useRef(onFiles);
  const addExternalRef = useRef(addExternal);
  useEffect(() => {
    onFilesRef.current = onFiles;
    addExternalRef.current = addExternal;
  });
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = imageFiles(event.clipboardData?.files);
      if (files.length) {
        event.preventDefault();
        void onFilesRef.current(files);
        return;
      }
      // Sin archivo: si fuera de un campo de texto pegan la URL de una foto, se agrega.
      const text = event.clipboardData?.getData("text/plain").trim() ?? "";
      if (!isEditable(event.target) && /^https?:\/\/\S+$/i.test(text)) {
        event.preventDefault();
        void addExternalRef.current(text.split(/\s+/));
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDropActive(false);
    if (dragFrom !== null) return; // reordenar lo maneja cada foto
    if (event.dataTransfer.files.length) {
      void onFiles(event.dataTransfer.files);
      return;
    }
    // Foto arrastrada desde otra pestaña: llega como URL.
    const uri = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    const html = event.dataTransfer.getData("text/html");
    const fromHtml = /<img[^>]+src="(https?:[^"]+)"/i.exec(html)?.[1];
    const urls = (fromHtml ? [fromHtml] : uri.split(/\s+/)).filter((u) => u && !u.startsWith("#"));
    if (urls.length) void addExternal(urls);
  }

  const btn = "rounded-md border border-ink-200 bg-surface px-2 py-1 text-[11px] font-bold text-ink-700 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:border-ink-400 disabled:opacity-30";
  const full = room - pending <= 0;

  return (
    <div
      className="space-y-4"
      onDragOver={(e) => {
        if (dragFrom !== null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!dropActive) setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false);
      }}
      onDrop={onDrop}
    >
      {images.length || pending ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url, index) => (
            <li
              key={url}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                setDragFrom(index);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                if (dragFrom === null) return; // un archivo: lo maneja el contenedor
                e.preventDefault();
                e.stopPropagation();
                onChange(move(images, dragFrom, index));
                setDragFrom(null);
              }}
              onDragEnd={() => setDragFrom(null)}
              className={`group overflow-hidden rounded-xl border bg-surface ${
                index === 0 ? "border-ink-900" : "border-ink-100"
              } ${dragFrom === index ? "opacity-40" : ""}`}
            >
              <div className="relative aspect-square cursor-grab bg-white active:cursor-grabbing">
                {broken[url] ? (
                  <div className="grid h-full place-items-center p-3 text-center text-xs font-semibold text-red-600">
                    La imagen no carga. Revisá la URL.
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    draggable={false}
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
                  className={`${btn} hover:border-red-600 hover:text-red-600`}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
          {Array.from({ length: pending }, (_, i) => (
            <li key={`pending-${i}`} className="grid aspect-square place-items-center rounded-xl border border-ink-200 bg-ink-50 text-xs font-semibold text-ink-500">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink-300 border-t-ink-700" aria-hidden />
                Subiendo…
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!full ? (
        <div
          className={`rounded-lg border transition-[background-color,color,border-color,box-shadow,opacity] duration-150 ${
            dropActive ? "border-brand-700 bg-surface ring-1 ring-brand-700" : "border-ink-200 bg-ink-50/50"
          }`}
        >
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-[background-color,color,border-color,box-shadow,opacity] duration-150 ${
                  dropActive ? "bg-brand-700 text-white" : "bg-surface text-ink-500 ring-1 ring-ink-200"
                }`}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zm8-12h.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-800">
                  {dropActive ? "Soltá las fotos para subirlas" : "Arrastrá fotos o pegalas con Ctrl+V"}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  JPG, PNG, WebP o GIF. Se optimizan solas.
                  {images.length === 0 ? " La primera es la principal." : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="rounded-lg bg-ink-900 px-3.5 py-2 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-700"
              >
                Subir archivo
              </button>
              <button
                type="button"
                onClick={() => setUrlOpen((v) => !v)}
                aria-expanded={urlOpen}
                className={`rounded-lg border px-3.5 py-2 text-sm font-bold transition-[background-color,color,border-color,box-shadow,opacity] duration-150 ${
                  urlOpen ? "border-ink-400 bg-surface text-ink-900" : "border-ink-200 bg-surface text-ink-700 hover:border-ink-300 hover:text-ink-900"
                }`}
              >
                Por URL
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              aria-label="Subir fotos"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {urlOpen ? (
            <div className="flex flex-col gap-2 border-t border-ink-200 p-3 sm:flex-row sm:p-4">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void addExternal(draft.split(/\s+/));
                    setDraft("");
                  }
                }}
                rows={1}
                autoFocus
                placeholder="Pegá URLs de fotos, una por línea"
                aria-label="URLs de fotos"
                className="min-h-10 w-full resize-y rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-400"
              />
              <button
                type="button"
                onClick={() => {
                  void addExternal(draft.split(/\s+/));
                  setDraft("");
                }}
                disabled={!draft.trim()}
                className="shrink-0 rounded-lg border border-ink-200 bg-surface px-4 py-2 text-sm font-bold text-ink-800 disabled:opacity-40"
              >
                Agregar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-ink-500">
        {full ? `Llegaste al máximo de ${MAX_IMAGES} fotos.` : `${images.length}/${MAX_IMAGES} fotos.`}
        {images.length > 1 ? " Arrastrá una foto sobre otra para reordenar." : ""}
      </p>
      {error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
