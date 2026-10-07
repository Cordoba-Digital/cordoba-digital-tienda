import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cambios y Devoluciones",
  description:
    "Queremos que estés 100% conforme: cambios y devoluciones simples, con 10 días para arrepentimiento en ventas online.",
};

export default function CambioDevolucionesPage() {
  return (
    <main className="container-xl py-14">
      <div className="card-surface mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">Cambios y Devoluciones</h1>
        <div className="prose-cd mt-6 space-y-4 text-sm leading-relaxed text-ink-700 md:text-base">
          <p>Queremos que estés 100% conforme con tu compra. Si te arrepentiste o el producto no es lo que esperabas, te facilitamos el proceso siguiendo la normativa vigente.</p>
          <ul className="space-y-3">
            <li>
              <strong>Derecho de Revocación (Botón de Arrepentimiento):</strong> Si realizaste tu compra online, tenés un plazo de
              <strong> diez (10) días corridos</strong> desde que recibís el producto para solicitar la devolución sin expresión de causa, según el Art. 34 de la
              Ley 24.240.
            </li>
            <li>
              <strong>Condiciones para el Cambio/Devolución:</strong>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>El producto debe estar <strong>sin uso, con sus etiquetas y en su embalaje original</strong> (cajas, manuales y accesorios completos).</li>
                <li>El sellado de fábrica (en caso de celulares y notebooks) debe estar intacto para que el producto mantenga su valor de reventa como nuevo.</li>
              </ul>
            </li>
            <li>
              <strong>Procedimiento:</strong> Podés gestionar el cambio o devolución directamente en nuestro local del centro de Córdoba para una resolución
              inmediata. Si sos del interior, escribinos a nuestro canal de WhatsApp para coordinar el envío.
            </li>
            <li>
              <strong>Reembolsos:</strong> En caso de devolución, el reintegro se realizará por el mismo medio de pago utilizado en la compra, una vez verificado el
              estado del producto.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
