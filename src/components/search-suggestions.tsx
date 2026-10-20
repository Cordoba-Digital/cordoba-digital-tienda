"use client";

import Image from "next/image";
import Link from "next/link";

import { money } from "@/lib/format";

export type SearchSuggestion = {
  slug: string;
  name: string;
  brand: string;
  price: number;
  image: string | null;
  categorySlug: string;
};

export type SearchShortcut = { label: string; href: string; count: number };

/** Destinos del desplegable en el orden en que se recorren con las flechas. */
export function suggestionHrefs(term: string, shortcuts: SearchShortcut[], results: SearchSuggestion[]): string[] {
  return [
    ...shortcuts.map((s) => s.href),
    ...results.map((r) => `/producto/${r.slug}`),
    `/productos?q=${encodeURIComponent(term.trim())}`,
  ];
}

/** Resalta en negrita las partes del texto que coinciden con lo que se escribió. */
function Highlight({ text, term }: { text: string; term: string }) {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = fold(term).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 1);
  if (!words.length) return <>{text}</>;
  // Letra por letra, para que las posiciones sigan valiendo en el texto original ("Cámaras").
  const folded = Array.from(text, fold).join("");
  if (folded.length !== text.length) return <>{text}</>;
  const marks = new Array<boolean>(text.length).fill(false);
  for (const w of words) {
    for (let at = folded.indexOf(w); at >= 0; at = folded.indexOf(w, at + 1)) {
      for (let i = at; i < at + w.length; i++) marks[i] = true;
    }
  }
  const parts: { text: string; on: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.on === marks[i]) last.text += text[i];
    else parts.push({ text: text[i], on: marks[i] });
  }
  return (
    <>
      {parts.map((p, i) => (p.on ? <strong key={i} className="font-extrabold text-ink-900">{p.text}</strong> : <span key={i}>{p.text}</span>))}
    </>
  );
}

export function SearchSuggestions({
  id,
  term,
  shortcuts,
  results,
  active,
  onHover,
  onPick,
}: {
  id: string;
  term: string;
  shortcuts: SearchShortcut[];
  results: SearchSuggestion[];
  active: number;
  onHover: (index: number) => void;
  onPick: () => void;
}) {
  const row = (index: number) =>
    `flex items-center gap-3 px-3 py-2.5 transition-[background-color] duration-150 ${active === index ? "bg-ink-50" : "hover:bg-ink-50"}`;
  const allIndex = shortcuts.length + results.length;

  return (
    <div
      id={id}
      role="listbox"
      className="absolute left-0 right-0 top-[52px] z-50 max-h-[70vh] animate-pop overflow-y-auto overscroll-contain rounded-2xl border border-ink-100 bg-surface shadow-2xl shadow-black/10"
    >
      {shortcuts.length ? (
        <div className="border-b border-ink-50 py-1">
          {shortcuts.map((s, i) => (
            <Link
              key={s.href}
              id={`${id}-${i}`}
              role="option"
              aria-selected={active === i}
              href={s.href}
              onClick={onPick}
              onMouseEnter={() => onHover(i)}
              className={row(i)}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-700">
                <Highlight text={s.label} term={term} />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-ink-400">
                {s.count} {s.count === 1 ? "producto" : "productos"}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {results.map((s, j) => {
        const i = shortcuts.length + j;
        return (
          <Link
            key={s.slug}
            id={`${id}-${i}`}
            role="option"
            aria-selected={active === i}
            href={`/producto/${s.slug}`}
            onClick={onPick}
            onMouseEnter={() => onHover(i)}
            className={`${row(i)} border-b border-ink-50`}
          >
            {s.image ? (
              <Image src={s.image} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="h-11 w-11 shrink-0 rounded-lg bg-ink-50" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink-700">
                <Highlight text={s.name} term={term} />
              </span>
              <span className="block text-xs text-ink-500">{s.brand}</span>
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-ink-900">{money(s.price)}</span>
          </Link>
        );
      })}

      <Link
        id={`${id}-${allIndex}`}
        role="option"
        aria-selected={active === allIndex}
        href={`/productos?q=${encodeURIComponent(term.trim())}`}
        onClick={onPick}
        onMouseEnter={() => onHover(allIndex)}
        className={`sticky bottom-0 block w-full px-3 py-2.5 text-center text-xs font-bold text-brand-700 transition-[background-color] duration-150 ${active === allIndex ? "bg-brand-50" : "bg-ink-50 hover:bg-brand-50"}`}
      >
        Ver todos los resultados para “{term.trim()}”
      </Link>
    </div>
  );
}
