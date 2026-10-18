"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Cada cuánto pregunta si hubo cambios, solo con la pestaña a la vista. */
const EVERY_MS = 5_000;

/**
 * Mantiene al día una pantalla del panel sin recargar: pregunta la huella de
 * los pedidos y, si cambió (entró uno nuevo, otro cambió de estado), vuelve a
 * pedir la página al servidor. Lo que se está escribiendo no se pierde. Con
 * la pestaña oculta no pregunta, y al volver pregunta enseguida.
 */
export function AdminOrdersLive({ firma }: { firma: string }) {
  const router = useRouter();
  const known = useRef(firma);

  useEffect(() => {
    known.current = firma;
  }, [firma]);

  useEffect(() => {
    let busy = false;
    let stopped = false;

    async function check() {
      if (stopped || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch("/api/admin/orders/novedades", { cache: "no-store" });
        // Sin sesión no tiene sentido seguir preguntando: la próxima acción lleva al login.
        if (res.status === 401) stopped = true;
        if (!res.ok) return;
        const data = (await res.json()) as { firma?: unknown };
        if (typeof data.firma === "string" && data.firma !== known.current) {
          known.current = data.firma;
          router.refresh();
        }
      } catch {
        // Sin conexión: se vuelve a probar en la próxima vuelta.
      } finally {
        busy = false;
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void check();
    }

    const timer = window.setInterval(check, EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  return null;
}
