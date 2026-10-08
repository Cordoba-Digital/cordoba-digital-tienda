import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/faq-accordion";
import { Banknote, RefreshCw, Shield, Truck } from "lucide-react";

import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description:
    "Plazos de envío, medios de pago, garantía y devoluciones de Córdoba Digital. Todo claro antes de comprar.",
};

/**
 * Contenido del centro de ayuda.
 *
 * Cada respuesta sale de un dato del sitio original: la política de garantía
 * (`/politica-de-garantia/`), el checkout real y los datos estructurados de la
 * home. Se sacaron las afirmaciones que no existían allá, entre ellas el 15% OFF
 * por transferencia, la "moto express", el retiro en 2 horas, los 12 meses de
 * garantía (son 6 por Ley 24.240) y los 10 días de devolución.
 */
const SECTIONS = [
  {
    id: "envios",
    icon: <Truck size={18} />,
    title: "Envíos y plazos",
    items: [
      {
        q: "¿Cuánto tarda mi pedido?",
        a: "Despachamos a todo el país con Andreani. Podés elegir entrega a domicilio o retiro en la sucursal más cercana. El plazo exacto se calcula con tu código postal antes de pagar.",
      },
      {
        q: "¿Cuánto cuesta el envío?",
        a: "Depende de la zona y del tamaño del paquete. Lo ves exacto antes de pagar: ingresás tu código postal en la ficha del producto y te mostramos el precio de cada opción. El retiro en el local no tiene cargo.",
      },
      {
        q: "¿Puedo seguir mi pedido?",
        a: "Sí. Al confirmar recibís un código CD-XXXXXX. Consultalo en la sección Seguir pedido o por WhatsApp cuando quieras.",
      },
      {
        q: "¿Hacen envíos a todo el país?",
        a: "Sí, a toda la Argentina. El envío lo hace Andreani y podés recibir en tu domicilio o retirar en la sucursal.",
      },
      {
        q: "¿Puedo retirar en el local?",
        a: "Sí, en 27 de Abril 180, Córdoba Capital. Lunes a viernes de 14:00 a 18:30 y sábados de 12:00 a 14:30.",
      },
    ],
  },
  {
    id: "pagos",
    icon: <Banknote size={18} />,
    title: "Medios de pago",
    items: [
      {
        q: "¿Qué medios de pago aceptan?",
        a: "Transferencia bancaria.",
      },
      {
        q: "¿Puedo pagar en efectivo?",
        a: "Sí, eligiendo retiro en el local de 27 de Abril 180.",
      },
      {
        q: "¿Cómo hago la transferencia?",
        a: "Al confirmar el pedido te mostramos el CBU o el alias.",
      },
    ],
  },
  {
    id: "garantia",
    icon: <Shield size={18} />,
    title: "Garantía y post-venta",
    items: [
      {
        q: "¿Qué garantía tienen los productos?",
        a: "De acuerdo con la Ley 24.240, todos nuestros productos nuevos cuentan con una garantía legal de seis (6) meses a partir de la entrega. En productos usados o reacondicionados, el plazo es de tres (3) meses.",
      },
      {
        q: "¿Qué cubre la garantía?",
        a: "Defectos de fabricación o fallas de funcionamiento de hardware que surjan bajo un uso normal y adecuado.",
      },
      {
        q: "¿Qué NO cubre la garantía?",
        a: "Daños por mal uso, golpes, contacto con líquidos, sobretensiones eléctricas o intervenciones de software no oficiales (flasheos o root).",
      },
      {
        q: "¿Qué hago si el producto falla?",
        a: "Traelo directamente a nuestro local en 27 de Abril 180, Córdoba Capital. Nosotros gestionamos el diagnóstico y la reparación con el servicio técnico oficial o propio, según corresponda.",
      },
      {
        q: "¿Qué necesito para hacer valer la garantía?",
        a: "Solo el comprobante de compra o la factura emitida por Córdoba Digital.",
      },
    ],
  },
  {
    id: "cambios",
    icon: <RefreshCw size={18} />,
    title: "Cambios y devoluciones",
    items: [
      {
        q: "¿Qué pasa si el producto llega dañado?",
        a: "No tenés que hacer nada: la garantía cubre defectos de fabricación y fallas de hardware. Traelo al local y lo revisamos.",
      },
      {
        q: "¿Puedo cambiar un producto?",
        a: "Escribinos por WhatsApp con tu número de pedido. Coordinamos el retiro o la visita al local y vemos el caso con la garantía vigente.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="container-xl py-10">
      <div className="mesh-dark mb-8 rounded-3xl p-8 text-white md:p-10">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Centro de ayuda</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-200 md:text-base">
          Todo lo que necesitás saber antes y después de comprar. Si no encontrás la respuesta, escribinos: contestamos
          en minutos de lunes a sábado.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20"
            >
              {section.icon} {section.title}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-40">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold text-ink-900">
                <span>{section.icon}</span>
                {section.title}
              </h2>
              <FaqAccordion items={section.items} />
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="card-surface sticky top-36 space-y-4 p-5">
            <h2 className="text-lg font-extrabold text-ink-900">Hablá con nosotros</h2>
            <a
              href="https://wa.me/5493516777774"
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-emerald-600"
            >
              WhatsApp · +54 351 677-7774
            </a>
            <a
              href="mailto:consultas@cordobadigital.net"
              className="block rounded-xl border border-ink-200 px-4 py-3 text-center text-sm font-bold text-ink-700 transition hover:border-brand-300"
            >
              consultas@cordobadigital.net
            </a>
            <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
              <p className="font-bold text-ink-900">Local: 27 de Abril 180</p>
              <p className="mt-1 text-xs">Córdoba Capital (CP 5000)</p>
              <p className="mt-2 text-xs">Lun a Vie 14:00 - 18:30</p>
              <p className="text-xs">Sábados 12:00 - 14:30</p>
            </div>
            <Link
              href="/seguimiento"
              className="block rounded-xl bg-brand-700 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-brand-800"
            >
              Seguir mi pedido
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
