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

  const findRes = await fetch("https://places.googleapis.com/v1/places:findPlace", {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "es", regionCode: "AR", maxResultCount: 1 }),
  });

  if (!findRes.ok) {
    console.error(`[reviews] findPlace falló: HTTP ${findRes.status}`);
    console.error(await findRes.text());
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
    console.error(`[reviews] El detalle falló: HTTP ${detailRes.status}`);
    console.error("  ¿La clave tiene habilitada Places API (New)?");
    console.error(await detailRes.text());
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
