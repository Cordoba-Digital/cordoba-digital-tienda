import type { Metadata } from "next";

import { ArrepentimientoForm } from "@/components/arrepentimiento-form";

export const metadata: Metadata = {
  title: "Botón de Arrepentimiento",
  description:
    "Solicitud de revocación de compra en Córdoba Digital: derecho a arrepentirse dentro de los 10 días corridos.",
};

export default function ArrepentimientoPage() {
  return (
    <main className="container-xl py-14">
      <div className="card-surface mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">Arrepentimiento</h1>
        <h2 className="mt-6 text-xl font-extrabold text-ink-900">Solicitud de Revocación de Compra</h2>
        <div className="prose-cd mt-4 space-y-4 text-sm leading-relaxed text-ink-700 md:text-base">
          <p>
            De acuerdo con lo establecido por la <strong>Ley 24.240 de Defensa del Consumidor</strong>, tenés derecho a revocar tu compra dentro de los
            <strong> diez (10) días corridos</strong> contados a partir de la fecha en que recibiste el producto o desde la celebración del contrato (lo que
            ocurra último).
          </p>
          <blockquote className="border-l-4 border-brand-400 pl-4 italic">
            <strong>Condiciones importantes:</strong>
            <ul className="mt-2 list-disc pl-5">
              <li>El producto debe estar sin uso, con sus etiquetas y en su embalaje original.</li>
              <li>Una vez enviada esta solicitud, nos pondremos en contacto en un plazo máximo de 24 horas hábiles para coordinar la devolución.</li>
              <li>Te enviaremos un <strong>código de identificación de trámite</strong> a tu correo electrónico de forma inmediata.</li>
            </ul>
          </blockquote>
          <p>
            1. Completá el formulario debajo.<br />
            2. Recibirás un <strong>Código de Gestión</strong> automático en tu mail.<br />
            3. Nos contactaremos para coordinar el retiro del equipo en nuestro local de <strong>27 de Abril 180</strong> o el envío por correo.
          </p>
          <ArrepentimientoForm />
        </div>
      </div>
    </main>
  );
}
