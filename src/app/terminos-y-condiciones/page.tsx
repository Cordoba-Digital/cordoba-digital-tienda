import type { Metadata } from "next";
import Link from "next/link";

import { PENDING_EXPIRY_HOURS, PICKUP_HOURS, SENA_EXPIRY_HOURS, SENA_PESOS, STOCK_HOLD_HOURS } from "@/lib/payment-rules";
import { MAX_QTY_PER_ITEM } from "@/lib/pricing";
import { DEFENSA_CONSUMIDOR_TEXTO, DEFENSA_CONSUMIDOR_URL, storeLegal } from "@/lib/store-legal";
import { money } from "@/lib/format";

const EMAIL = "consultas@cordobadigital.net";
const LINK = "font-semibold text-brand-700 underline";
const H2 = "pt-2 text-lg font-extrabold text-ink-900";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Condiciones de compra en Córdoba Digital: precios, stock, medios de pago, seña para retirar, envíos, garantía y botón de arrepentimiento.",
};

/**
 * Reemplaza `/terminos-condiciones/` del WordPress (redirige acá, ver
 * `next.config.ts`). Los plazos y montos salen de `payment-rules.ts` y
 * `pricing.ts`: si cambia una regla del checkout, cambia acá también.
 * Mercado Pago no figura porque la tienda se lanza sin pasarela; si se prende,
 * hay que sumarlo a "Medios de pago".
 */
export default function TerminosPage() {
  const { razonSocial, cuit } = storeLegal();
  return (
    <main className="container-xl py-14">
      <div className="card-surface mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">Términos y condiciones</h1>
        <p className="mt-2 text-sm text-ink-500">Última actualización: 23 de octubre de 2026</p>
        <div className="prose-cd mt-6 space-y-4 text-sm leading-relaxed text-ink-700 md:text-base">
          <p>
            Estos términos rigen las compras en www.cordobadigital.net. Al confirmar un pedido aceptás estas condiciones, junto con
            la{" "}
            <Link href="/politica-de-envios" className={LINK}>
              Política de Envíos
            </Link>
            , la{" "}
            <Link href="/politica-de-garantia" className={LINK}>
              Política de Garantía
            </Link>{" "}
            y la{" "}
            <Link href="/politica-privacidad" className={LINK}>
              Política de Privacidad
            </Link>
            . Nada de lo que dice esta página limita los derechos que te da la Ley 24.240 de Defensa del Consumidor.
          </p>

          <h2 className={H2}>Quiénes somos</h2>
          <p>
            Córdoba Digital
            {razonSocial ? <>, de {razonSocial}</> : null}
            {cuit ? <> (CUIT {cuit})</> : null}, con local en 27 de Abril 180, Córdoba Capital. Contacto:{" "}
            <a href={`mailto:${EMAIL}`} className={LINK}>
              {EMAIL}
            </a>{" "}
            o{" "}
            <a href="https://wa.me/5493516777774" target="_blank" rel="noreferrer" className={LINK}>
              WhatsApp al 351 677-7774
            </a>
            .
          </p>

          <h2 className={H2}>Productos, precios y stock</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Los precios están en <strong>pesos argentinos</strong> y son los que ves al confirmar el pedido. El precio en dólares que
              muestran algunos productos es solo de referencia.
            </li>
            <li>Los precios y las ofertas pueden cambiar sin aviso, pero nunca cambian el de un pedido ya confirmado.</li>
            <li>Las ofertas valen por el plazo que indican o hasta agotar stock.</li>
            <li>
              Podés comprar hasta <strong>{MAX_QTY_PER_ITEM} unidades</strong> de cada producto por pedido. Si necesitás más,
              escribinos.
            </li>
            <li>
              Si un producto se agota después de que pagaste, te avisamos y elegís entre un cambio por otro producto o la{" "}
              <strong>devolución total</strong> de lo que pagaste.
            </li>
          </ul>

          <h2 className={H2}>Pedidos</h2>
          <p>
            Al confirmar la compra recibís un <strong>número de orden</strong>. El pedido queda <strong>esperando el pago</strong>{" "}
            hasta que lo acreditamos. Mientras tanto le guardamos el stock durante {STOCK_HOLD_HOURS} horas; después el producto vuelve
            a la venta y, si el pago llega, se confirma siempre que siga habiendo stock. Si el pago no llega en{" "}
            {PENDING_EXPIRY_HOURS} horas, la orden se cancela sola.
          </p>

          <h2 className={H2}>Medios de pago</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Transferencia bancaria</strong> desde cualquier banco o billetera virtual, a la cuenta que te mostramos al
              comprar. Acreditamos el pedido cuando vemos la transferencia.
            </li>
            <li>
              <strong>Seña para retirar en el local:</strong> pagás {money(SENA_PESOS)} por transferencia dentro de las{" "}
              {SENA_EXPIRY_HOURS} horas y el resto al retirar. Con la seña acreditada te guardamos el producto{" "}
              {PICKUP_HOURS} horas. Si no lo retirás en ese plazo, la reserva se cancela, el producto vuelve a la venta y te
              escribimos para resolver la seña.
            </li>
            <li>
              <strong>USDT por la red TRON:</strong> el monto en USDT se calcula con la cotización de la tienda al confirmar y queda
              fijo en el pedido. Mandá exactamente ese monto, solo por la red TRON, a la dirección que te mostramos: un envío por otra
              red o a otra dirección no se puede recuperar.
            </li>
            <li>
              <strong>Efectivo</strong>, solo en el local.
            </li>
          </ul>
          <p>
            Emitimos factura por cada compra con el DNI o CUIT que nos das al comprar. Los cupones de descuento se aplican sobre los
            productos, no sobre el envío, y valen hasta su vencimiento o tope de usos.
          </p>

          <h2 className={H2}>Envíos y retiro</h2>
          <p>
            Enviamos a todo el país por Andreani, con seguimiento. El costo se muestra antes de confirmar la compra y los plazos están en
            la{" "}
            <Link href="/politica-de-envios" className={LINK}>
              Política de Envíos
            </Link>
            . También podés retirar sin cargo en el local, de lunes a viernes de 14:00 a 18:30 y los sábados de 12:00 a 14:30.
          </p>

          <h2 className={H2}>Garantía, cambios y arrepentimiento</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Los productos nuevos tienen la garantía legal que explica la{" "}
              <Link href="/politica-de-garantia" className={LINK}>
                Política de Garantía
              </Link>
              .
            </li>
            <li>
              Si compraste online, tenés <strong>10 días corridos</strong> desde que recibís el producto para arrepentirte, sin dar
              motivos. Lo pedís desde el{" "}
              <Link href="/arrepentimiento" className={LINK}>
                Botón de Arrepentimiento
              </Link>{" "}
              y te mandamos un código de trámite por email. Los gastos de devolución corren por nuestra cuenta y te devolvemos el
              total por el mismo medio de pago.
            </li>
            <li>
              Los cambios están en{" "}
              <Link href="/cambio-devoluciones" className={LINK}>
                Cambios y Devoluciones
              </Link>
              .
            </li>
          </ul>

          <h2 className={H2}>Tus datos</h2>
          <p>
            Usamos tus datos solo para procesar el pedido, facturarlo y enviarlo. Qué guardamos, por cuánto tiempo y cómo pedir que lo
            borremos está en la{" "}
            <Link href="/politica-privacidad" className={LINK}>
              Política de Privacidad
            </Link>
            .
          </p>

          <h2 className={H2}>Consultas y reclamos</h2>
          <p>
            Escribinos a{" "}
            <a href={`mailto:${EMAIL}`} className={LINK}>
              {EMAIL}
            </a>{" "}
            o por WhatsApp. También podés reclamar ante la Ventanilla Única Federal:{" "}
            <a href={DEFENSA_CONSUMIDOR_URL} target="_blank" rel="noreferrer" className={LINK}>
              {DEFENSA_CONSUMIDOR_TEXTO}
            </a>
            .
          </p>

          <h2 className={H2}>Cambios en estos términos</h2>
          <p>
            Podemos actualizar estos términos. Cada pedido se rige por los que estaban publicados el día que lo confirmaste. Se aplican
            las leyes de la República Argentina, en especial la Ley 24.240 de Defensa del Consumidor.
          </p>
        </div>
      </div>
    </main>
  );
}
