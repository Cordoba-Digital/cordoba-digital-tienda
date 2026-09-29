"use client";

/**
 * Boton de tema claro / oscuro.
 *
 * No guarda el tema en estado de React a proposito: los dos iconos se renderizan
 * siempre y la variante `dark:` (atada a la clase `.dark`, no a la preferencia
 * del sistema) decide cual se ve. Asi el HTML que manda el servidor y el que
 * ve el visitante son identicos y no aparece la advertencia de hidratacion, que
 * es justo lo que pasaria si el icono dependiera de un `useState` inicializado
 * en el cliente.
 *
 * La escritura en `localStorage` va envuelta en `try`: con la cookies de
 * terceros bloqueadas o en navegacion privada el almacenamiento puede tirar, y
 * que el toggle no funcione es mejor que romper la pagina.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    // Sin esto, los controles nativos (select, barras de scroll, calendario)
    // siguen pintandose en claro sobre la pagina oscura.
    root.style.colorScheme = next;
    try {
      localStorage.setItem("cd-theme", next);
    } catch {
      /* modo privado: el tema dura lo que dura la pestana */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar entre tema claro y oscuro"
      title="Cambiar entre tema claro y oscuro"
      className="grid h-10 w-10 place-items-center rounded-xl text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
    >
      {/* Luna: se ve en claro, el click lleva a oscuro. */}
      <svg
        viewBox="0 0 24 24"
        className="h-5.5 w-5.5 dark:hidden"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Sol: se ve en oscuro, el click vuelve a claro. */}
      <svg
        viewBox="0 0 24 24"
        className="hidden h-5.5 w-5.5 dark:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path
          d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.3 6.3L4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
