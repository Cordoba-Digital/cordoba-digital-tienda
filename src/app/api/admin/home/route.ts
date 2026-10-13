import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { readAdminSession } from "@/lib/admin-session";
import { HOME_BLOCKS, parseHomeLayout } from "@/lib/home-layout";
import { saveHomeLayout } from "@/lib/home-layout-server";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

const LABELS = new Map<string, string>(HOME_BLOCKS.map((block) => [block.id, block.label]));

/** Guarda el orden y la visibilidad de los bloques de la home. Cualquier admin puede. */
export async function PUT(request: Request) {
  const session = await readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
  if (!session) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { blocks?: unknown } | null;
  if (!body || !Array.isArray(body.blocks)) {
    return Response.json({ ok: false, error: "Faltan los bloques." }, { status: 400 });
  }
  const layout = parseHomeLayout(body.blocks);
  const actor = adminActorLabel(session);
  try {
    await saveHomeLayout(layout, actor);
  } catch (error) {
    console.error("[admin-home] no se pudo guardar:", error);
    return Response.json({ ok: false, error: "No se pudo guardar. Probá de nuevo." }, { status: 500 });
  }

  refreshStorePages();

  const order = layout.filter((item) => item.visible).map((item) => LABELS.get(item.id));
  const hidden = layout.filter((item) => !item.visible).map((item) => LABELS.get(item.id));
  await logAdminAction(actor, {
    action: "inicio_editado",
    entityType: "inicio",
    entityId: "home",
    summary: `Ordenó la home: ${order.join(", ")}${hidden.length ? `. Ocultos: ${hidden.join(", ")}` : ""}`,
  });
  return Response.json({ ok: true, blocks: layout });
}
