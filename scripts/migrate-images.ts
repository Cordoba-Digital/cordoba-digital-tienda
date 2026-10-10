/**
 * Copia las fotos de producto del WordPress viejo al almacenamiento propio
 * (Vercel Blob o R2) desde la terminal. Lo mismo hace el botón de
 * Panel → Fotos; ver src/lib/wp-image-migration.ts.
 *
 *   npm run images:migrate                        # solo cuenta lo pendiente
 *   npm run images:migrate -- --yes --limit=20    # prueba con 20 productos
 *   npm run images:migrate -- --yes               # todo el catálogo
 *
 * Requiere DATABASE_URL y BLOB_READ_WRITE_TOKEN (o las R2_*). Escribe en
 * `products.images`: hacer un backup de la base antes.
 */
import "dotenv/config";

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function main() {
  const { pool } = await import("@/db");
  const { migrateWpImages, wpImageStatus } = await import("@/lib/wp-image-migration");

  const status = await wpImageStatus();
  console.log(
    `[images] destino: ${status.store ?? "ninguno"} · productos con fotos del WordPress: ${status.pendingProducts} · fotos: ${status.pendingImages}`,
  );
  if (!process.argv.includes("--yes")) {
    console.log("[images] Modo prueba: no se copió nada. Para copiar: npm run images:migrate -- --yes");
    await pool.end();
    return;
  }

  const limit = Number(arg("limit")) || Infinity;
  const skip: number[] = [];
  let done = 0;
  let copied = 0;
  let failed = 0;
  while (done < limit) {
    const batch = await migrateWpImages({ timeBudgetMs: 60_000, maxProducts: Math.min(50, limit - done), skip });
    if (!batch.products) break;
    done += batch.products;
    copied += batch.copied;
    failed += batch.failed;
    skip.push(...batch.failedProductIds);
    for (const e of batch.errors) console.error(`[images] falló ${e}`);
    console.log(`[images] ${done} productos · ${copied} fotos · ${failed} fallas · quedan ${batch.remainingProducts}`);
  }
  console.log("[images] Listo. Las fallas quedaron con su URL vieja: volver a correrlo las reintenta.");
  await pool.end();
}

main().catch((error) => {
  console.error(`[images] FATAL: ${(error as Error).message}`);
  process.exit(1);
});
