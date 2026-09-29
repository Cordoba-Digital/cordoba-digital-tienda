import type { Metadata } from "next";
import Link from "next/link";

/**
 * Not-found de `/pedido/[code]`: mismo mensaje que la pagina de tracking, pero
 * con status 404 de verdad. La ruta ya es `noindex`, asi que esto no compite
 * en el indice; lo que evita es que un `200 OK` con HTML de error se cuente
 * como una URL valida mas del sitio.
 */
export const metadata: Metadata = {
  title: "No encontramos ese pedido",
  robots: { index: false, follow: true },
};

export default function OrderNotFound() {
  return (
    <div className="container-xl py-16">
      <div className="card-surface mx-auto flex max-w-lg flex-col items-center gap-3 px-8 py-14 text-center">
        <span className="text-5xl">🔎</span>
        <h1 className="text-xl font-extrabold text-ink-900">No encontramos ese pedido</h1>
        <p className="text-sm text-ink-500">
          Revisá el código (tiene el formato CD-XXXXXX) o escribinos por WhatsApp y lo buscamos por vos.
        </p>
        <div className="mt-2 flex gap-3">
          <Link href="/seguimiento" className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white">
            Buscar mi pedido
          </Link>
          <a
            href="https://wa.me/5493516777774"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-ink-200 px-5 py-3 text-sm font-bold text-ink-700"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
