import type { Metadata } from "next";
import Link from "next/link";

/**
 * Esta pagina reemplaza a la ruta que llamo a `notFound()` (producto,
 * categoria, pedido). El titulo tiene que distinguirla de una pagina real: si
 * cae en el titulo por defecto del layout, un 404 es indistinguible de un
 * producto mas en el HTML y no sirve ni para depurar ni para auditar.
 *
 * `noindex` es lo que Next ya inyecta en las respuestas 404, pero dejarlo
 * explicito evita que un dia seGuarde y alguien lo lea como un indexable mas.
 */
export const metadata: Metadata = {
  title: "Página no encontrada (404)",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="container-xl py-20">
      <div className="card-surface mx-auto flex max-w-xl flex-col items-center gap-4 px-8 py-16 text-center">
        <span className="text-6xl">🛰️</span>
        <h1 className="text-3xl font-black tracking-tight text-ink-900">Página no encontrada</h1>
        <p className="text-sm text-ink-500">
          El link que seguiste no existe o el producto ya no está publicado. Probá buscando en el catálogo.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white">
            Volver al inicio
          </Link>
          <Link href="/productos" className="rounded-xl border border-ink-200 px-5 py-3 text-sm font-bold text-ink-700">
            Ver catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
