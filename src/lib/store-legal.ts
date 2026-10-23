/**
 * Datos legales del comercio que se muestran en el pie y en Términos y
 * condiciones. Salen de variables de entorno (como `STORE_CUIT`), así se cargan
 * en Vercel sin tocar el código; mientras estén vacías no se imprime nada.
 *
 * - `STORE_RAZON_SOCIAL`: nombre del titular ante ARCA (persona o sociedad).
 * - `STORE_CUIT`: 11 números, con o sin guiones.
 * - `STORE_DATA_FISCAL_URL`: el link del "Formulario 960/D - Data Fiscal" que
 *   genera ARCA para el sitio (RG 3377/2012). Del script que da ARCA se copia
 *   solo el `href`, por ejemplo `http://qr.afip.gob.ar/?qr=...`.
 */

/**
 * Formulario de reclamos de la Ventanilla Única Federal. La Res. 274/2021 de la
 * Secretaría de Comercio Interior pide enlazarlo con este texto en la página
 * principal de quien vende en entornos digitales.
 */
export const DEFENSA_CONSUMIDOR_URL = "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario";
export const DEFENSA_CONSUMIDOR_TEXTO = "Defensa de las y los Consumidores. Para reclamos ingrese aquí";

/** Imagen oficial de Data Fiscal que ARCA indica pegar junto al link. */
export const DATA_FISCAL_IMG = "https://www.afip.gob.ar/images/f960/DATAWEB.jpg";

const DATA_FISCAL_HOSTS = new Set(["qr.afip.gob.ar", "qr.arca.gob.ar"]);

export type StoreLegal = {
  razonSocial: string;
  /** Formateado como 20-12345678-9, o vacío si no hay uno válido. */
  cuit: string;
  /** Link de Data Fiscal en https, o vacío si no es de ARCA. */
  dataFiscalUrl: string;
};

export function formatCuit(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return "";
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/**
 * Solo acepta links de ARCA: el pie está en todas las páginas y una variable mal
 * pegada no puede terminar enlazando a cualquier lado. Se pasa a https porque
 * ARCA entrega el link con http y el navegador lo bloquearía o avisaría.
 */
export function dataFiscalUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    if (!DATA_FISCAL_HOSTS.has(url.hostname) || !url.searchParams.get("qr")) return "";
    url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
}

export function storeLegal(env: Record<string, string | undefined> = process.env): StoreLegal {
  return {
    razonSocial: (env.STORE_RAZON_SOCIAL ?? "").trim(),
    cuit: formatCuit(env.STORE_CUIT ?? ""),
    dataFiscalUrl: dataFiscalUrl(env.STORE_DATA_FISCAL_URL ?? ""),
  };
}
