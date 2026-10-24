import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/quienes-somos" },
  title: "¿Quiénes somos?",
  description:
    "Córdoba Digital: especialistas en tecnología desde 2007, con local físico, soporte post-venta y envíos a todo el país.",
};

export default function QuienesSomosPage() {
  return (
    <main className="container-xl py-14">
      <div className="card-surface mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">¿Quiénes somos?</h1>
        <div className="prose-cd mt-6 space-y-4 text-sm leading-relaxed text-ink-700 md:text-base">
          <p>
            En Córdoba Digital somos especialistas en tecnología con una trayectoria consolidada en el corazón de Córdoba Capital. El negocio nace en
            2007, bajo el concepto de trabajo Just It Time, que nos permite ofrecer un extenso catálogo de productos con margen mínimos de ganancia, logrando
            ofrecer un mejor precio a nuestros clientes pero sin degradar calidad ni servicio personalizado. Desde nuestro local ubicado en 27 de Abril 180, nos
            hemos posicionado como el referente nacional en la comercialización de celulares liberados de las primeras marcas, notebooks y el armado de PC
            personalizadas a medida.
          </p>
          <p>
            Nuestra autoridad se basa en el conocimiento técnico profundo y un soporte post-venta directo que garantiza la inversión de nuestros clientes.
            Combinamos un catálogo actualizado de marcas líderes con la calidez de la atención presencial, ofreciendo soluciones digitales, garantía y retiro
            físico en el centro de la ciudad. No solo vendemos equipos; brindamos la confianza y el respaldo técnico que el usuario de Argentina busca al elegir
            su próxima herramienta tecnológica. A diferencia de Marketplace como MercadoLibre, en nuestro negocio podés hacer todas las consultas necesarias y el
            asesoramiento personalizado para elegir el producto que mejor se adapte a tus necesidades y sobretodo a tu presupuesto. No somos un sitio web de
            ventas, somos una solución integral a tus necesidades.
          </p>
        </div>
      </div>
    </main>
  );
}
