"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminIcon } from "@/components/admin-icon";
import { ADMIN_NAV, ADMIN_SEARCH_EVENT, type AdminIconName } from "@/components/admin-nav-items";

type Result = { key: string; label: string; hint: string; href: string; icon: AdminIconName };

/** Saca tildes y mayúsculas para comparar ("pagina" encuentra "Página"). */
function plain(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Buscador del panel (⌘K o Ctrl+K): salta a una sección o busca el texto en
 * pedidos, productos o usuarios con los buscadores que ya tiene cada pantalla.
 */
export function AdminSearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const show = () => {
      setQ("");
      setIndex(0);
      setOpen(true);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((was) => {
          if (!was) {
            setQ("");
            setIndex(0);
          }
          return !was;
        });
      }
    };
    window.addEventListener(ADMIN_SEARCH_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(ADMIN_SEARCH_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const text = q.trim();
    const needle = plain(text);
    const sections = ADMIN_NAV.filter((item) => !needle || plain(item.label).includes(needle)).map((item) => ({
      key: item.href,
      label: item.label,
      hint: "Ir a la sección",
      href: item.href,
      icon: item.icon,
    }));
    if (!text) return sections;
    const query = encodeURIComponent(text);
    return [
      { key: "pedidos", label: `Buscar “${text}” en pedidos`, hint: "Código, cliente o email", href: `/admin/pedidos?q=${query}`, icon: "pedidos" },
      { key: "productos", label: `Buscar “${text}” en productos`, hint: "Nombre, SKU o marca", href: `/admin/productos?q=${query}`, icon: "productos" },
      { key: "usuarios", label: `Buscar “${text}” en usuarios`, hint: "Nombre o email", href: `/admin/usuarios?q=${query}`, icon: "usuarios" },
      ...sections,
    ];
  }, [q]);

  if (!open) return null;

  const current = Math.min(index, results.length - 1);

  function go(result: Result | undefined) {
    if (!result) return;
    setOpen(false);
    router.push(result.href);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en el panel"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#15171c] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]"
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-4">
          <span className="text-[#80848d]">
            <AdminIcon name="buscar" />
          </span>
          <input
            ref={input}
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(results[current]);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Buscar pedidos, productos, clientes o secciones…"
            aria-label="Buscar en el panel"
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-search-results"
            aria-activedescendant={results[current] ? `admin-search-${results[current].key}` : undefined}
            className="h-14 flex-1 !rounded-none !border-0 !bg-transparent !outline-none text-[15px] text-white outline-none"
          />
          <kbd className="rounded-md border border-white/[0.14] px-1.5 py-0.5 font-sans text-[11px] text-[#9a9ea7]">Esc</kbd>
        </div>
        <ul id="admin-search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[#9a9ea7]">No hay secciones con ese nombre.</li>
          ) : (
            results.map((result, i) => (
              <li
                key={result.key}
                id={`admin-search-${result.key}`}
                role="option"
                aria-selected={i === current}
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(result)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${i === current ? "bg-white/[0.07] text-white" : "text-[#d5d8de]"}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${i === current ? "bg-brand-500/20 text-[#ff8a5b]" : "bg-white/[0.05] text-[#9a9ea7]"}`}>
                  <AdminIcon name={result.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{result.label}</span>
                  <span className="block truncate text-xs text-[#80848d]">{result.hint}</span>
                </span>
                {i === current ? <span className="text-xs text-[#80848d]">Enter</span> : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
