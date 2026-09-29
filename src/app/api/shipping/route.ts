import { normalizeZip, shippingOptions, zoneForZip } from "@/lib/shipping";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // El subtotal ya no se usa: no hay envio gratis por monto.
  const body = (await request.json().catch(() => ({}))) as { zip?: string };
  const zip = normalizeZip(body.zip ?? "");

  if (zip.length !== 4) {
    return Response.json({ ok: false, error: "Ingresá un código postal válido de 4 dígitos." }, { status: 400 });
  }

  const zone = zoneForZip(zip);
  if (!zone) {
    return Response.json({ ok: false, error: "No encontramos ese código postal." }, { status: 404 });
  }

  return Response.json({
    ok: true,
    zip,
    zone: zone.name,
    options: shippingOptions(zip),
  });
}
