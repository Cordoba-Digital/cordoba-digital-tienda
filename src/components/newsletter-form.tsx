"use client";

import { useState } from "react";

export function NewsletterForm({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div
        className={`rounded-xl px-4 py-3 text-sm font-semibold ${
          variant === "dark" ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        ¡Listo! Te avisamos cuando haya ingresos nuevos y ofertas.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state === "error") setState("idle");
        }}
        placeholder="tu@email.com"
        className={`h-12 w-full rounded-xl px-4 text-[15px] outline-none transition ${
          variant === "dark"
            ? "border border-white/15 bg-white/5 text-white placeholder:text-ink-400 focus:border-neon-400"
            : "border border-ink-200 bg-surface text-ink-900 placeholder:text-ink-400 focus:border-brand-400"
        } ${state === "error" ? "border-rose-400" : ""}`}
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="h-12 w-full whitespace-nowrap rounded-xl bg-gradient-to-r from-brand-500 to-neon-500 px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {state === "loading" ? "Enviando..." : "Quiero recibir ofertas"}
      </button>
    </form>
  );
}
