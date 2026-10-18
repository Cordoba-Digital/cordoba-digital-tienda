import Script from "next/script";

/**
 * Google Analytics 4 con gtag.js.
 *
 * Solo mide en `host` (el dominio de `SITE_URL`). La propiedad es la misma que
 * usaba el WordPress, con años de historial: sin este filtro, los previews de
 * Vercel, `localhost` y las pruebas internas sumarían visitas y compras falsas.
 * gtag.js ni se descarga fuera de ese dominio.
 *
 * Las navegaciones del lado del cliente no recargan la página, pero GA4 las
 * cuenta igual con la medición mejorada ("cambios de página según el historial
 * del navegador"), que viene activada por defecto en el flujo web.
 */
export function GoogleAnalytics({ measurementId, host }: { measurementId: string; host: string }) {
  if (!/^G-[A-Z0-9]+$/i.test(measurementId) || !host) return null;
  return (
    <Script id="ga4-init" strategy="afterInteractive">
      {`if (location.hostname === ${JSON.stringify(host)}) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', ${JSON.stringify(measurementId)});
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ${JSON.stringify(measurementId)};
  document.head.appendChild(s);
}`}
    </Script>
  );
}
