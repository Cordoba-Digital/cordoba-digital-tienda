"use client";

import { useEffect, useState } from "react";

export function WhatsAppFab() {
  const [visible, setVisible] = useState(false);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 260);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const tip = window.setTimeout(() => setShowTip(true), 5200);
    const hide = window.setTimeout(() => setShowTip(false), 14000);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(tip);
      window.clearTimeout(hide);
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-4 z-[55] flex items-end gap-2">
      {showTip ? (
        <div className="animate-pop max-w-[15rem] rounded-2xl rounded-br-sm border border-ink-100 bg-white px-3.5 py-2.5 text-xs font-medium text-ink-700 shadow-xl">
          ¿Dudas con tu compra? Te asesoramos en el momento 👋
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-2">
        {visible ? (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Volver arriba"
            className="grid h-10 w-10 place-items-center rounded-full border border-ink-200 bg-white text-ink-600 shadow-lg transition hover:text-brand-700"
          >
            ↑
          </button>
        ) : null}
        <a
          href="https://wa.me/5493516777774?text=Hola%20C%C3%B3rdoba%20Digital!%20Tengo%20una%20consulta"
          target="_blank"
          rel="noreferrer"
          aria-label="Escribinos por WhatsApp"
          className="relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,0.8)] transition hover:scale-105"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/40" />
          <svg viewBox="0 0 24 24" className="relative h-7 w-7" fill="currentColor">
            <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.45 1.34 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.92-7.04A9.88 9.88 0 0012.04 2zm5.8 14.13c-.25.7-1.44 1.33-1.99 1.38-.53.05-1.02.24-3.43-.72-2.89-1.14-4.73-4.08-4.87-4.27-.14-.19-1.16-1.55-1.16-2.95 0-1.41.73-2.1.99-2.38.26-.29.57-.36.76-.36l.55.01c.18 0 .41-.07.64.49.25.6.83 2.06.9 2.21.07.14.12.31.02.5-.09.19-.14.31-.28.48l-.42.49c-.14.14-.28.29-.12.57.16.29.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.17-.19.7-.81.88-1.09.19-.29.37-.24.62-.14.26.09 1.65.78 1.93.92.28.14.47.21.54.33.07.11.07.66-.18 1.36z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
