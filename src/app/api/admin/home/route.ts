import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { readAdminSession } from "@/lib/admin-session";
import { HOME_BLOCKS, parseHomeLayout } from "@/lib/home-layout";
import { getTopBarVisible, saveHomeLayout, saveTopBarVisible } from "@/lib/home-layout-server";
import { refreshStorePages, refreshWholeStore } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

const LABELS = new Map<string, string>(HOME_BLOCKS.map((block) => [block.id, block.label]));

/**
 * Guarda el orden y la visibilidad de los bloques de la home y, si viene, si se
 * muestra la barra de avisos de arriba del header. Cualquier admin puede.
 */
export async function PUT(request: Request) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { blocks?: unknown; topBar?: unknown } | null;
  if (!body || !Array.isArray(body.blocks)) {
    return Response.json({ ok: false, error: "Faltan los bloques." }, { status: 400 });
  }
  const layout = parseHomeLayout(body.blocks);
  const actor = adminActorLabel(session);
  const topBarBefore = await getTopBarVisible();
  const topBar = typeof body.topBar === "boolean" ? body.topBar : topBarBefore;
  try {
    await saveHomeLayout(layout, actor);
    if (topBar !== topBarBefore) await saveTopBarVisible(topBar, actor);
  } catch (error) {
    console.error("[admin-home] no se pudo guardar:", error);
    return Response.json({ ok: false, error: "No se pudo guardar. Probá de nuevo." }, { status: 500 });
  }

  // La barra va en todas las páginas: si cambió, se refresca la tienda entera.
  if (topBar !== topBarBefore) refreshWholeStore();
  else refreshStorePages();

  const order = layout.filter((item) => item.visible).map((item) => LABELS.get(item.id));
  const hidden = layout.filter((item) => !item.visible).map((item) => LABELS.get(item.id));
  await logAdminAction(actor, {
    action: "inicio_editado",
    entityType: "inicio",
    entityId: "home",
    summary: `Ordenó la home: ${order.join(", ")}${hidden.length ? `. Ocultos: ${hidden.join(", ")}` : ""}${
      topBar !== topBarBefore ? `. Barra de avisos: ${topBar ? "visible" : "oculta"}` : ""
    }`,
  });
  return Response.json({ ok: true, blocks: layout, topBar });
}
