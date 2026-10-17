import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { adminActorLabel, sessionFromCookieHeader } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { readAdminSession } from "@/lib/admin-session";
import { HERO_SLIDES, parseHeroSettings } from "@/lib/hero-picks";
import { getHeroAdminState, getHeroSettings, saveHeroSettings } from "@/lib/hero-picks-server";
import { refreshStorePages } from "@/lib/store-cache";

export const dynamic = "force-dynamic";

const LABELS = new Map<string, string>(HERO_SLIDES.map((slide) => [slide.id, slide.label]));

async function session(request: Request) {
  return readAdminSession(sessionFromCookieHeader(request.headers.get("cookie")));
}

/** Qué producto va hoy en cada slide del carrusel, y qué está fijado o sacado. */
export async function GET(request: Request) {
  if (!(await session(request))) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  return Response.json({ ok: true, state: await getHeroAdminState() });
}

/** Guarda los productos fijados por slide y los sacados del carrusel: `{ pinned, excluded }`. */
export async function PUT(request: Request) {
  const admin = await session(request);
  if (!admin) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Faltan los datos." }, { status: 400 });
  }
  const next = parseHeroSettings(body);
  const named = [...new Set([...Object.values(next.pinned), ...next.excluded])];
  const found = named.length
    ? new Set((await db.select({ slug: products.slug }).from(products).where(inArray(products.slug, named))).map((r) => r.slug))
    : new Set<string>();
  const missing = Object.values(next.pinned).find((slug) => !found.has(slug));
  if (missing) return Response.json({ ok: false, error: "Ese producto no existe." }, { status: 400 });
  // Un producto fijado no puede estar sacado a la vez: gana lo último que se pidió, fijarlo.
  next.excluded = next.excluded.filter((slug) => !Object.values(next.pinned).includes(slug));

  const before = await getHeroSettings();
  const actor = adminActorLabel(admin);
  try {
    await saveHeroSettings(next, actor);
  } catch (error) {
    console.error("[admin-portada] no se pudo guardar:", error);
    return Response.json({ ok: false, error: "No se pudo guardar. Probá de nuevo." }, { status: 500 });
  }
  refreshStorePages();

  const changes: string[] = [];
  for (const slide of HERO_SLIDES) {
    const was = before.pinned[slide.id];
    const now = next.pinned[slide.id];
    if (was === now) continue;
    changes.push(now ? `fijó ${now} en ${LABELS.get(slide.id)}` : `dejó ${LABELS.get(slide.id)} en automático`);
  }
  for (const slug of next.excluded) if (!before.excluded.includes(slug)) changes.push(`sacó ${slug}`);
  for (const slug of before.excluded) if (!next.excluded.includes(slug)) changes.push(`volvió a permitir ${slug}`);
  if (changes.length) {
    await logAdminAction(actor, {
      action: "portada_editada",
      entityType: "inicio",
      entityId: "carrusel",
      summary: `Carrusel de la portada: ${changes.join(", ")}`,
    });
  }
  return Response.json({ ok: true, state: await getHeroAdminState() });
}
