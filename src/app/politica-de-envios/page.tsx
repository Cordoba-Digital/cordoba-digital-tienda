import type { Metadata } from "next";
import Link from "next/link";

const EMAIL = "consultas@cordobadigital.net";

export const metadata: Metadata = {
  alternates: { canonical: "/politica-de-envios" },
  title: "Política de Envíos",
  description:
    "Enviamos a todo el país por Andreani: despacho en el día si confirmás antes de las 16 hs y entrega en 1 a 4 días hábiles.",
};

/**
 * Texto de `/politica-de-envios/` del WordPress (misma dirección, así que no
 * necesita redirect). Se corrigieron los restos de borrador que tenía publicados
 * allá: el "[Elegí la opción que corresponda]" de la plantilla, los corchetes del
 * plazo de 48 horas y el email mal escrito.
 */
export default function PoliticaDeEnviosPage() {
  return (
    <main className="container-xl py-14">
      <div className="card-surface mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">Política de Envíos</h1>
        <div className="prose-cd mt-6 space-y-4 text-sm leading-relaxed text-ink-700 md:text-base">
          <p>
            En Córdoba Digital enviamos a todo el país a través de <strong>Andreani</strong>. Esta página detalla los tiempos, costos y
            condiciones de envío de los productos publicados en www.cordobadigital.net.
          </p>

          <h2 className="pt-2 text-lg font-extrabold text-ink-900">Tiempo de preparación y despacho</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Los pedidos confirmados <strong>hasta las 16:00 hs</strong> (hora de Argentina), de lunes a viernes hábiles, se despachan{" "}
              <strong>el mismo día</strong>.
            </li>
            <li>
              Los pedidos confirmados <strong>después de las 16:00 hs</strong> se despachan <strong>el siguiente día hábil</strong>.
            </li>
            <li>Los pedidos realizados sábados, domingos o feriados se despachan el siguiente día hábil.</li>
          </ul>

          <h2 className="pt-2 text-lg font-extrabold text-ink-900">Tiempo de entrega</h2>
          <p>
            Una vez despachado, Andreani entrega el pedido en <strong>1 a 3 días hábiles</strong>.
          </p>
          <p>
            <strong>Tiempo total estimado desde la compra: 1 a 4 días hábiles.</strong>
          </p>
          <p>
            En algunas localidades alejadas o de difícil acceso el plazo puede extenderse hasta <strong>5 días hábiles</strong>. Si tu
            localidad tiene un plazo especial, te lo informaremos antes de confirmar la compra.
          </p>

          <h2 className="pt-2 text-lg font-extrabold text-ink-900">Costo del envío</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              El costo del envío se calcula según el código postal de destino y la modalidad elegida, y{" "}
              <strong>se muestra antes de finalizar la compra</strong>.
            </li>
            <li>
              <strong>Envío gratis</strong> en <strong>productos seleccionados</strong>.
            </li>
            <li>
              Costo de envío a domicilio: <strong>desde $10.000</strong>. Costo de retiro en sucursal: <strong>desde $7.000</strong>.
            </li>
            <li>
              El retiro en nuestro local de 27 de Abril 180, Córdoba Capital, <strong>no tiene cargo</strong>.
            </li>
          </ul>

          <h2 className="pt-2 text-lg font-extrabold text-ink-900">Seguimiento del pedido</h2>
          <p>
            Al despachar tu pedido te enviamos el <strong>número de seguimiento de Andreani</strong>, para que puedas ver el estado del
            envío en todo momento. También podés consultarlo en{" "}
            <Link href="/seguimiento" className="font-semibold text-brand-700 underline">
              Seguir mi pedido
            </Link>{" "}
            con tu código de pedido.
          </p>

          <h2 className="pt-2 text-lg font-extrabold text-ink-900">Seguro y embalaje</h2>
          <p>
            Toda la mercadería viaja <strong>asegurada</strong> y con un <strong>embalaje reforzado</strong> para que llegue en perfectas
            condiciones.
          </p>
          <p>
            Si recibís el paquete dañado o abierto, no lo aceptes y contactanos dentro de las <strong>48 horas</strong> a{" "}
            <a href={`mailto:${EMAIL}`} className="font-semibold text-brand-700 underline">
              {EMAIL}
            </a>{" "}
            o al 351 677-7774.
          </p>

          <h2 className="pt-2 text-lg font-extrabold text-ink-900">Contacto</h2>
          <p>
            Por cualquier consulta sobre tu envío escribinos a{" "}
            <a href={`mailto:${EMAIL}`} className="font-semibold text-brand-700 underline">
              {EMAIL}
            </a>{" "}
            o por{" "}
            <a href="https://wa.me/5493516777774" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
              WhatsApp al 351 677-7774
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
