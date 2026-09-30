import type { Metadata } from "next";
import { Suspense } from "react";

import { TrackingForm } from "@/components/tracking-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seguí tu pedido",
  description: "Consultá el estado de tu compra con el código de pedido y tu email.",
};

export default function TrackingPage() {
  return (
    <div className="container-xl py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">Seguí tu pedido</h1>
        <p className="mt-1 text-sm text-ink-500">
          Ingresá el código que te enviamos por mail (formato CD-XXXXXX) y te mostramos el estado actualizado.
        </p>
        <Suspense fallback={null}>
          <TrackingForm />
        </Suspense>

        <div className="card-surface mt-6 p-5">
          <h2 className="text-sm font-extrabold text-ink-900">¿No encontrás tu código?</h2>
          <p className="mt-1 text-sm text-ink-500">
            Buscá el mail de confirmación con asunto “Tu pedido en Córdoba Digital” o escribinos por WhatsApp con tu DNI
            y lo buscamos en el momento.
          </p>
          <a
            href="https://wa.me/5493516777774"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600"
          >
            Escribir por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
