import { eq } from "drizzle-orm";

import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { defaultHomeLayout, parseHomeLayout, type HomeLayoutItem } from "@/lib/home-layout";

export const HOME_LAYOUT_KEY = "home_layout";

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
