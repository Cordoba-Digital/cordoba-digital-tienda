"use client";

import { useState } from "react";

export function AdminCopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* sin portapapeles: no hacemos nada */
        }
      }}
      className="rounded-md border border-ink-200 bg-surface px-2 py-1 text-[11px] font-bold text-ink-600 hover:border-ink-400 hover:text-ink-900"
    >
      {copied ? "Copiado" : label}
    </button>
  );
}
