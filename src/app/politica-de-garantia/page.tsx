import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Garantía",
  description:
    "Protegés tu inversión: todos los productos nuevos tienen 6 meses de garantía legal y soporte técnico directo.",
};

export default function PoliticaGarantiaPage() {
  return (
    <main className="container-xl py-14">
      <div className="card-surface mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">Políticas de Garantía</h1>
        <div className="prose-cd mt-6 space-y-4 text-sm leading-relaxed text-ink-700 md:text-base">
          <p>
            En <strong>Córdoba Digital</strong>, tu inversión está protegida. Todos nuestros productos cuentan con garantía legal y soporte técnico directo para tu
            tranquilidad.
          </p>
          <ul className="space-y-3">
            <li>
              <strong>Plazo de Garantía:</strong> De acuerdo con la Ley 24.240, todos nuestros productos nuevos cuentan con una garantía legal de
              <strong> seis (6) meses</strong> a partir de la entrega. En productos usados o reacondicionados, el plazo es de tres (3) meses.
            </li>
            <li>
              <strong>Cobertura:</strong> La garantía cubre defectos de fabricación o fallas de funcionamiento de hardware que surjan bajo un uso normal y
              adecuado.
            </li>
            <li>
              <strong>Servicio Técnico Local:</strong> Si el producto presenta una falla, podés traerlo directamente a nuestro local en
              <strong> 27 de Abril 180, Córdoba Capital</strong>. Nosotros gestionamos el diagnóstico y la reparación con el servicio técnico oficial o propio,
              según corresponda.
            </li>
            <li>
              <strong>Exclusiones:</strong> La garantía no cubre daños por mal uso, golpes, contacto con líquidos, sobretensiones eléctricas o intervenciones de
              software no oficiales (flasheos/root).
            </li>
            <li>
              <strong>Documentación:</strong> Para hacer valer la garantía, solo necesitás presentar el comprobante de compra o factura emitida por Córdoba Digital.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
