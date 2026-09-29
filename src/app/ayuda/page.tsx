import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description:
    "Plazos de envío, medios de pago, cuotas, garantía y devoluciones de Córdoba Digital. Todo claro antes de comprar.",
};

const SECTIONS = [
  {
    id: "envios",
    icon: "🚚",
    title: "Envíos y plazos",
    items: [
      {
        q: "¿Cuánto tarda mi pedido?",
        a: "Entre 24 y 72 horas hábiles según la zona. En Córdoba Capital ofrecemos moto express en el día (comprando antes de las 16 hs) y retiro en el local en 2 horas.",
      },
      {
        q: "¿Cuánto cuesta el envío?",
        a: "Desde $4.900 en Córdoba Capital y hasta $13.900 en Patagonia. Es gratis en compras desde $250.000 con envío estándar. El costo exacto se calcula con tu código postal antes de pagar.",
      },
      {
        q: "¿Puedo seguir mi pedido?",
        a: "Sí. Al confirmar recibís un código CD-XXXXXX. Consultalo en la sección Seguir pedido o por WhatsApp cuando quieras.",
      },
      {
        q: "¿Hacen envíos a todo el país?",
        a: "Sí, a toda la Argentina excepto Tierra del Fuego, con Correo Argentino y Andreani.",
      },
    ],
  },
  {
    id: "pagos",
    icon: "💳",
    title: "Medios de pago y cuotas",
    items: [
      {
        q: "¿Qué descuento tengo por transferencia o USDT?",
        a: "15% OFF sobre el precio de lista. Se aplica automáticamente al elegir el medio de pago en el checkout.",
      },
      {
        q: "¿Cuántas cuotas puedo hacer?",
        a: "Hasta 6 cuotas sin interés con Visa, Mastercard, Amex, Naranja X y Cabal. También 9 y 12 cuotas fijas con interés informado antes de confirmar.",
      },
      {
        q: "¿Puedo pagar en efectivo?",
        a: "Sí, eligiendo retiro en el local de 27 de Abril 259. Reservamos el producto por 48 horas hábiles.",
      },
      {
        q: "¿Emiten factura?",
        a: "Siempre. Factura A o B según tu condición frente a AFIP. Por eso te pedimos DNI o CUIT en el checkout.",
      },
    ],
  },
  {
    id: "garantia",
    icon: "🛡️",
    title: "Garantía y post-venta",
    items: [
      {
        q: "¿Qué garantía tienen los productos?",
        a: "Todos los productos son nuevos y tienen 12 meses de garantía oficial (24 o 60 meses en algunos monitores y SSD). La gestionamos nosotros desde Córdoba.",
      },
      {
        q: "¿Qué hago si el producto falla?",
        a: "Escribinos por WhatsApp con tu número de pedido. Coordinamos el retiro o la visita al local y gestionamos la reparación o el cambio.",
      },
      {
        q: "¿Ofrecen soporte para configurar el equipo?",
        a: "Sí. Migramos tus datos, instalamos el sistema operativo y configuramos tu equipo sin cargo en el local.",
      },
    ],
  },
  {
    id: "cambios",
    icon: "🔄",
    title: "Cambios y devoluciones",
    items: [
      {
        q: "¿Puedo arrepentirme de la compra?",
        a: "Sí. Según la Ley de Defensa del Consumidor tenés 10 días corridos desde la recepción para solicitar la devolución del importe.",
      },
      {
        q: "¿Cómo se hace la devolución del dinero?",
        a: "Por el mismo medio de pago utilizado. En transferencias devolvemos a tu CBU dentro de las 72 horas hábiles de recibido el producto.",
      },
      {
        q: "¿Qué pasa si el producto llega dañado?",
        a: "Nos hacemos cargo del 100%: retiramos el producto sin costo y enviamos uno nuevo o devolvemos el dinero, lo que prefieras.",
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

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-40">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold text-ink-900">
                <span>{section.icon}</span>
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <details key={item.q} className="card-surface group p-4 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-bold text-ink-900">
                      {item.q}
                      <span className="text-lg text-ink-300 transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2.5 text-sm leading-relaxed text-ink-600">{item.a}</p>
                  </details>
                ))}
              </div>
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
              className="block rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-emerald-600"
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
              <p className="font-bold text-ink-900">Local: 27 de Abril 259</p>
              <p className="mt-1 text-xs">Córdoba Capital (CP 5000)</p>
              <p className="mt-2 text-xs">Lun a Vie 14:00 - 18:30</p>
              <p className="text-xs">Sábados 11:00 - 14:00</p>
            </div>
            <Link
              href="/seguimiento"
              className="block rounded-xl bg-brand-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-brand-700"
            >
              Seguir mi pedido
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
