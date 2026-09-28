/**
 * Prueba la configuración de Google Places sin deployar nada.
 *
 * Uso:
 *   GOOGLE_PLACES_API_KEY=... npm run reviews:check
 *   npm run reviews:check -- "Córdoba Digital, 27 de Abril 259, Córdoba"
 *
 * Si no hay key, imprime qué falta y cómo obtenerla.
 */
import "dotenv/config";

const DEFAULT_QUERY = "Córdoba Digital, 27 de Abril 259, Córdoba, Argentina";

/**
 * Los errores de Google son crípticos si solo mostrás el status. Acá se
 * traducen a lo que hay que hacer, que es lo que le sirve a quien configuró
 * la clave.
 */
async function explain(res: Response, action: string) {
  const raw = await res.text();
  let message = raw;
  let reason = "";
  let project = "";
  try {
    const data = JSON.parse(raw) as {
      error?: { message?: string; details?: { reason?: string; metadata?: Record<string, string> }[] };
    };
    message = data.error?.message ?? raw;
    const info = data.error?.details?.find((d) => d.reason)?.metadata;
    reason = data.error?.details?.find((d) => d.reason)?.reason ?? "";
    project = info?.consumer?.replace("projects/", "") ?? "";
  } catch {
    // respuesta no-JSON (p. ej. 404 vacío)
  }

  console.error(`\n[reviews] No se pudo ${action}.`);
  console.error(`[reviews] HTTP ${res.status} · ${reason || "sin código"}`);
  console.error(`[reviews] Google dice: ${message.split("\n")[0]}`);
  if (project) console.error(`[reviews] Proyecto: ${project}`);
  console.error("\n[reviews] Qué hacer según el motivo:");

  if (reason === "API_KEY_SERVICE_BLOCKED") {
    console.error("  La clave está restringida a otras APIs y Places no está incluida.");
    console.error("  1. Editá la clave (console.cloud.google.com → APIs y servicios → Credenciales).");
    console.error("  2. En 'Restricciones de API': elegí 'Places API (New)' en lugar de la lista actual.");
    console.error("  3. Guardá y probá de nuevo.");
  } else if (res.status === 403) {
    console.error("  1. Habilitá 'Places API (New)' en APIs y servicios → Biblioteca.");
    console.error("  2. Revisá que la clave no esté restringida a otra API.");
  } else if (res.status === 404) {
    console.error("  Habilitá 'Places API (New)' en APIs y servicios → Biblioteca del proyecto.");
  } else if (res.status === 429) {
    console.error("  Cuota de la API agotada o clave restringida por cuota diaria.");
  }
  console.error("");
}

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const query = process.argv[2]?.trim() || process.env.GOOGLE_PLACE_QUERY?.trim() || DEFAULT_QUERY;

  if (!apiKey) {
    console.log("[reviews] Falta GOOGLE_PLACES_API_KEY.");
    console.log("[reviews] Cómo obtenerla (gratis, ~5 min):");
    console.log("  1. console.cloud.google.com -> creá o elegí un proyecto");
    console.log("  2. APIs y servicios -> Biblioteca -> buscá 'Places API (New)' -> Habilitar");
    console.log("  3. APIs y servicios -> Credenciales -> Crear credenciales -> Clave de API");
    console.log("  4. Restringí la clave a 'Places API (New)' y por IP de Vercel si querés");
    console.log(`[reviews] Con la key puesta, el Place ID se resuelve solo con: ${query}`);
    return;
  }

  // `searchText` es el endpoint de Places API (New). `findPlace` es del API
  // anterior y devuelve 404.
  const findRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "es", regionCode: "AR", maxResultCount: 1 }),
  });

  if (!findRes.ok) {
    await explain(findRes, "buscar la ficha");
    process.exitCode = 1;
    return;
  }

  const found = (await findRes.json()) as {
    places?: { id: string; displayName?: { text?: string }; formattedAddress?: string; rating?: number; userRatingCount?: number }[];
  };
  const place = found.places?.[0];
  if (!place) {
    console.error(`[reviews] No se encontró ninguna ficha para: ${query}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[reviews] Ficha: ${place.displayName?.text ?? "?"}`);
  console.log(`[reviews] Dirección: ${place.formattedAddress ?? "?"}`);
  console.log(`[reviews] Place ID: ${place.id}`);
  console.log(`[reviews] Puntuación: ${place.rating ?? "?"} (${place.userRatingCount ?? 0} reseñas)`);

  const detailRes = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(place.id)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "rating,userRatingCount,review,googleMapsUri",
    },
  });

  if (!detailRes.ok) {
    await explain(detailRes, "leer las reseñas");
    process.exitCode = 1;
    return;
  }

  const detail = (await detailRes.json()) as {
    rating?: number;
    userRatingCount?: number;
    review?: { authorAttribution?: { displayName?: string }; rating?: number; text?: { text?: string } }[];
  };

  console.log(`[reviews] Reseñas disponibles: ${detail.review?.length ?? 0}`);
  for (const r of (detail.review ?? []).slice(0, 5)) {
    const text = (r.text?.text ?? "").replace(/\s+/g, " ").trim();
    console.log(`  ${r.rating}★ ${r.authorAttribution?.displayName ?? "?"}: ${text.slice(0, 110)}…`);
  }
  console.log(`[reviews] Listo: con la key en Vercel la home las muestra solas.`);
}

main().catch((error) => {
  console.error(`[reviews] FATAL: ${(error as Error).message}`);
  process.exit(1);
});
