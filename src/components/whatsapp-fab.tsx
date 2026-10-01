"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Botón flotante de WhatsApp.
 *
 * Antes era un círculo de 56 px con una punta de balloon que aparecía a los
 * 5,2 s y se iba a los 14 s. Ahora es una píldora con el ícono y el texto
 * "¿Dudas con tu compra?", que es lo que dice la maqueta: la punta repetía en
 * texto flotante lo que la píldora ya muestra siempre, y encima tapaba el
 * contenido de la esquina. El ícono y el ping animado también se fueron, que
 * sobre una píldora el ping no tiene sentido.
 *
 * Al lado queda el botón de volver arriba, que era un círculo y sigue siendo
 * uno, pero blanco con borde en vez de del color de la tinta.
 *
 * El verde es `#0F8040` y no el `#25D366` de la maqueta: ese da 1,98:1 con
 * texto blanco y el control de contraste lo rechaza (pide 4,5:1). `#0F8040` es
 * de la misma familia de verde y da 5,02:1, así que la píldora sigue leyéndose
 * como WhatsApp y el texto se puede leer.
 */
export function WhatsAppFab() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 260);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed bottom-5 right-4 z-[55] flex max-w-[calc(100vw-2rem)] items-center gap-2">
      <a
        href="https://wa.me/5493516777774?text=Hola%20C%C3%B3rdoba%20Digital!%20Tengo%20una%20consulta"
        target="_blank"
        rel="noreferrer"
        aria-label="Escribinos por WhatsApp"
        className="inline-flex min-w-0 items-center justify-center rounded-full bg-[#0F8040] p-3 text-[14px] font-semibold text-white shadow-[0_12px_30px_-8px_rgba(15,128,64,0.85)] transition hover:scale-[1.03]"
      >
        <Image src="/images/logo.png" alt="Córdoba Digital" width={20} height={20} className="h-5 w-5 object-contain" />
      </a>

      {visible ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Volver arriba"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink-200 bg-surface text-ink-600 shadow-lg transition hover:border-ink-300 hover:text-brand-700"
        >
          ↑
        </button>
      ) : null}
    </div>
  );
}
