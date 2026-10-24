import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/por-que-elegirnos" },
  title: "¿Por qué elegirnos?",
  description:
    "Conocé por qué Córdoba Digital combina tienda física, stock real, especialistas Xiaomi y garantía local con envíos a todo el país.",
};

export default function PorQueElegirnosPage() {
  return (
    <main className="container-xl py-14">
      <div className="card-surface mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">¿Por qué elegirnos?</h1>
        <div className="prose-cd mt-6 space-y-4 text-sm leading-relaxed text-ink-700 md:text-base">
          <p>
            En un mercado saturado de opciones digitales, en <strong>Córdoba Digital</strong> marcamos la diferencia combinando la agilidad del e-commerce con la
            seguridad de una tienda física establecida. Estas son las razones por las que miles de clientes cordobeses y de todo el país confían en nosotros:
          </p>
          <h2 className="text-xl font-extrabold text-ink-900">1. Presencia Física y Respaldo Real</h2>
          <p>
            A diferencia de los vendedores exclusivamente online, nosotros estamos donde vos estás. Nuestra tienda en <strong>27 de Abril 180, Córdoba Capital</strong>,
            es el centro de nuestra operación. Aquí podés retirar tus compras en el día, ver los equipos en funcionamiento y contar con un rostro humano para
            cualquier consulta. Los equipos se prueban y te ayudamos con la configuración inicial, para que te lleves tu equipo funcionando.
          </p>
          <h2 className="text-xl font-extrabold text-ink-900">2. Especialistas en Ecosistemas Xiaomi y Alta Gama</h2>
          <p>
            No somos un bazar de tecnología generalista. Somos expertos en el 
            <strong>lineup de Xiaomi</strong>, notebooks de alto rendimiento y <strong>armado de PC</strong>. Conocemos cada especificación técnica de los equipos
            que vendemos, lo que nos permite asesorarte para que compres exactamente lo que necesitás, ni más ni menos.
          </p>
          <h2 className="text-xl font-extrabold text-ink-900">3. Garantía Local y Soporte Técnico Directo</h2>
          <p>
            Comprar en Córdoba Digital significa olvidarte de los trámites engorrosos de garantías a larga distancia. Si tu equipo presenta un inconveniente, lo
            traés a nuestro local y nosotros gestionamos la solución. <strong>Nuestra garantía es local, real y rápida.</strong>
          </p>
          <h2 className="text-xl font-extrabold text-ink-900">4. Stock Físico e Inmediatez</h2>
          <p>
            En Córdoba Digital, si el producto figura en la web, está en nuestro depósito. Esto nos permite ofrecer <strong>retiros inmediatos</strong> en el centro de
            Córdoba y envíos en tiempos récord, eliminando las esperas innecesarias de los grandes marketplaces nacionales.
          </p>
        </div>
      </div>
    </main>
  );
}
