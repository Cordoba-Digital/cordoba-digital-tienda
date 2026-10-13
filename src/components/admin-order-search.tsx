"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Buscador de pedidos que filtra mientras se escribe (sin apretar "Buscar").
 * Sin JavaScript sigue funcionando como formulario GET común.
 */
export function AdminOrderSearch({ initial, status }: { initial: string; status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function go(next: string) {
    // Buscar vuelve a la página 1 y conserva el filtro de estado.
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (next.trim()) query.set("q", next.trim());
    const qs = query.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <form
      action={pathname}
      method="get"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        window.clearTimeout(timer.current);
        go(value);
      }}
      className="relative min-w-0 flex-1"
    >
      {status ? <input type="hidden" name="status" value={status} /> : null}
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden>
        <circle cx="9" cy="9" r="5.5" />
        <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
      </svg>
      <input
        name="q"
        type="search"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => go(next), 300);
        }}
        placeholder="Buscar por código, nombre o email…"
        aria-label="Buscar pedidos"
        className="w-full rounded-lg border border-ink-200 bg-surface py-2.5 pl-9 pr-24 text-sm text-ink-900 outline-none focus:border-ink-400"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400" aria-live="polite">
        {pending ? "Buscando…" : ""}
      </span>
    </form>
  );
}
