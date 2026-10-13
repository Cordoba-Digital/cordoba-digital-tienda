import { normalizeZip, shippingOptions, zoneForZip } from "@/lib/shipping";
import { preciosAndreani, type ItemCarrito } from "@/lib/shipping-andreani";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // El subtotal ya no se usa: no hay envio gratis por monto.
  const body = (await request.json().catch(() => ({}))) as { zip?: string; items?: ItemCarrito[] };
  const zip = normalizeZip(body.zip ?? "");

  if (zip.length !== 4) {
    return Response.json({ ok: false, error: "Ingresá un código postal válido de 4 dígitos." }, { status: 400 });
  }

  const zone = zoneForZip(zip);
  if (!zone) {
    return Response.json({ ok: false, error: "No encontramos ese código postal." }, { status: 404 });
  }

  // Con los productos del carrito se pide el precio real a Andreani (por peso y
  // medidas). Si no se puede, quedan las tarifas fijas por zona.
  const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  const andreani = items.length ? await preciosAndreani(zip, items) : {};

  return Response.json({
    ok: true,
    zip,
    zone: zone.name,
    options: shippingOptions(zip, andreani),
    andreani: andreani.estandar !== undefined || andreani.sucursal !== undefined,
  });
}
