import { eq } from "drizzle-orm";

import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { defaultHomeLayout, parseHomeLayout, parseTopBar, type HomeLayoutItem } from "@/lib/home-layout";

export const HOME_LAYOUT_KEY = "home_layout";
export const TOP_BAR_KEY = "header_top_bar";

export type HomeLayoutRecord = { layout: HomeLayoutItem[]; updatedBy: string | null; updatedAt: Date | null };

/**
 * Orden y visibilidad de los bloques de la home. Si la base no responde, o la
 * migración de `store_settings` todavía no se aplicó, la home sale con todos
 * los bloques en el orden por defecto: nunca queda en blanco.
 */
export async function getHomeLayoutRecord(): Promise<HomeLayoutRecord> {
  try {
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, HOME_LAYOUT_KEY)).limit(1);
    if (!row) return { layout: defaultHomeLayout(), updatedBy: null, updatedAt: null };
    return { layout: parseHomeLayout(row.value), updatedBy: row.updatedBy, updatedAt: row.updatedAt };
  } catch (error) {
    console.warn("[home] sin orden guardado, uso el de siempre:", error instanceof Error ? error.message : error);
    return { layout: defaultHomeLayout(), updatedBy: null, updatedAt: null };
  }
}

export async function getHomeLayout(): Promise<HomeLayoutItem[]> {
  return (await getHomeLayoutRecord()).layout;
}

/** Guarda el orden ya validado con `parseHomeLayout`. */
export async function saveHomeLayout(layout: HomeLayoutItem[], actor: string): Promise<void> {
  const now = new Date();
  await db
    .insert(storeSettings)
    .values({ key: HOME_LAYOUT_KEY, value: layout, updatedBy: actor, updatedAt: now })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: layout, updatedBy: actor, updatedAt: now } });
}

/**
 * Si se muestra la barra de avisos de arriba del header. Ante cualquier error
 * de la base se muestra, que es como estuvo siempre.
 */
export async function getTopBarVisible(): Promise<boolean> {
  try {
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, TOP_BAR_KEY)).limit(1);
    return parseTopBar(row?.value);
  } catch (error) {
    console.warn("[header] sin ajuste de la barra de avisos, la muestro:", error instanceof Error ? error.message : error);
    return true;
  }
}

export async function saveTopBarVisible(visible: boolean, actor: string): Promise<void> {
  const now = new Date();
  const value = { visible };
  await db
    .insert(storeSettings)
    .values({ key: TOP_BAR_KEY, value, updatedBy: actor, updatedAt: now })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedBy: actor, updatedAt: now } });
}
