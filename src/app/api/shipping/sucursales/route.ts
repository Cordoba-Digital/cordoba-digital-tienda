import { andreaniConfigurado, AndreaniError, sucursales, sucursalesEnCache } from "@/lib/andreani";
import { ANDREANI_LIMIT, blockedMinutes, ipFromHeaders, recordMiss } from "@/lib/rate-limit";
import { normalizeZip } from "@/lib/shipping";

export const dynamic = "force-dynamic";

/** Sucursales de Andreani para retirar, por código postal del cliente. */
export async function GET(request: Request) {
  const cp = normalizeZip(new URL(request.url).searchParams.get("cp") ?? "");
  if (cp.length !== 4) {
    return Response.json({ ok: false, error: "Ingresá un código postal válido de 4 dígitos." }, { status: 400 });
  }
  if (!andreaniConfigurado()) {
    return Response.json({ ok: true, sucursales: [] });
  }
  try {
    if (!sucursalesEnCache(cp)) {
      const ip = ipFromHeaders(request.headers);
      if (await blockedMinutes(ANDREANI_LIMIT, ip)) return Response.json({ ok: true, sucursales: [] });
      await recordMiss(ANDREANI_LIMIT, ip);
    }
    const lista = await sucursales(cp);
    return Response.json(
      { ok: true, sucursales: lista.slice(0, 30) },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    console.warn("[andreani] sucursales no disponibles:", error instanceof AndreaniError ? error.message : "error inesperado");
    return Response.json({ ok: true, sucursales: [] });
  }
}
