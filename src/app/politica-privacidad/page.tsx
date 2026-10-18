import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Políticas de Privacidad",
  description:
    "Cómo recolectamos, protegemos y utilizamos tus datos personales en Córdoba Digital.",
};

export default function PoliticaPrivacidadPage() {
  return (
    <main className="container-xl py-14">
      <div className="card-surface mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">Políticas de Privacidad</h1>
        <div className="prose-cd mt-6 space-y-4 text-sm leading-relaxed text-ink-700 md:text-base">
          <p>
            En <strong>Córdoba Digital</strong> (www.cordobadigital.net), la privacidad de nuestros clientes es una prioridad. Este documento detalla cómo
            recolectamos, protegemos y utilizamos tu información personal, garantizando el cumplimiento de la <strong>Ley N° 25.326 de Protección de Datos
            Personales</strong> en la República Argentina.
          </p>
          <h2 className="text-xl font-extrabold text-ink-900">1. Información que Recolectamos</h2>
          <p>Para procesar tus compras y brindarte una mejor experiencia, solicitamos datos como:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Datos de Identificación:</strong> Nombre, apellido y DNI/CUIT (para facturación).</li>
            <li><strong>Datos de Contacto:</strong> Correo electrónico, teléfono y dirección de envío.</li>
            <li>
              <strong>Información de Pago:</strong> Pagás por transferencia bancaria, desde cualquier banco o billetera virtual, o en efectivo en el
              local. No pedimos ni guardamos datos de tarjetas.
            </li>
          </ul>
          <h2 className="text-xl font-extrabold text-ink-900">2. Finalidad del Tratamiento</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Gestionar el procesamiento y envío de tus pedidos tecnológicos.</li>
            <li>Brindarte soporte técnico y gestionar las garantías en nuestro local.</li>
            <li>Enviarte comunicaciones sobre el estado de tu pedido.</li>
            <li>Si lo autorizas, informarte sobre lanzamientos de Xiaomi y ofertas exclusivas de nuestra tienda.</li>
          </ul>
          <h2 className="text-xl font-extrabold text-ink-900">3. Protección y Seguridad de los Datos</h2>
          <p>
            Implementamos medidas de seguridad técnicas y organizativas para evitar la pérdida, mal uso o acceso no autorizado a tu información. Nuestro sitio web
            cuenta con un <strong>certificado de seguridad SSL</strong>, que garantiza que la transmisión de tus datos personales sea cifrada y segura.
          </p>
          <h2 className="text-xl font-extrabold text-ink-900">4. Transferencia a Terceros</h2>
          <p>Córdoba Digital no vende ni alquila tus datos a terceros. Solo compartimos la información estrictamente necesaria con:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Empresas de logística (para realizar la entrega de tus productos).</li>
            <li>Pasarelas de pago (para validar la transacción financiera).</li>
            <li>Autoridades legales, en caso de ser requerido por normativa vigente.</li>
          </ul>
          <h2 className="text-xl font-extrabold text-ink-900">5. Tus Derechos (Derechos ARCO)</h2>
          <p>
            Como titular de los datos, tenés derecho a acceder, rectificar, actualizar o solicitar la supresión de tu información personal. Para ejercer estos
            derechos, podés contactarnos enviando un correo a <strong>consultas@cordobadigital.net</strong> o visitándonos en nuestro local de
            <strong> 27 de Abril 180, Córdoba Capital</strong>.
          </p>
          <h2 className="text-xl font-extrabold text-ink-900">6. Uso de Cookies</h2>
          <p>
            Nuestro sitio utiliza cookies para mejorar la navegación y recordar tus preferencias. Podés configurar tu navegador para bloquearlas, aunque esto podría
            afectar el funcionamiento de algunas secciones de la tienda.
          </p>
        </div>
      </div>
    </main>
  );
}
