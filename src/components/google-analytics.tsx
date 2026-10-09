import Script from "next/script";

/**
 * Google Analytics 4 con gtag.js.
 *
 * Las navegaciones del lado del cliente no recargan la página, pero GA4 las
 * cuenta igual con la medición mejorada ("cambios de página según el historial
 * del navegador"), que viene activada por defecto en el flujo web.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
    </>
  );
}
