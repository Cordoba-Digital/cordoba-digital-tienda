export type GoogleReview = {
  author: string;
  rating: number;
  text: string;
  time?: string;
  source: "google";
};

export type GoogleReviewsResult = {
  rating: number | null;
  count: number | null;
  reviews: GoogleReview[];
  fallback: boolean;
  placeUrl: string;
};

/**
 * Sin `GOOGLE_PLACES_API_KEY` no hay reseñas: se devuelve `reviews: []` y
 * `fallback: true`.
 *
 * Deliberadamente NO inventamos testimonios. La versión anterior-usaba
 * nombres y textos ficticios ("Rocío Fernández", 4,8★, 458 reseñas) y el
 * cliente los iba a ver en su propia web: si alguno de esos clientes no
 * existe, se pierde la confianza del primer vistazo. Sin la API, la home
 * muestra los datos verificables del negocio en su lugar.
 */
let cache: { at: number; data: GoogleReviewsResult } | null = null;
const TTL_MS = 24 * 60 * 60 * 1000;

/** Dirección por defecto: sirve para resolver el Place ID sola. */
const DEFAULT_QUERY = "Córdoba Digital, 27 de Abril 259, Córdoba, Argentina";

/**
 * Resuelve el Place ID a partir del nombre y la dirección, para que el
 * cliente no tenga que buscarlo a mano. Usa Find Place (New), que devuelve el
 * primer resultado con la mayor calificación.
 */
async function findPlaceId(apiKey: string, query: string): Promise<string | null> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:findPlace", {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "es",
        regionCode: "AR",
        maxResultCount: 1,
      }),
      next: { revalidate: 604800 }, // el id no cambia: una semana
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: { id?: string }[] };
    return data.places?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

let placeIdCache: { at: number; id: string | null } | null = null;

async function resolvePlaceId(apiKey: string): Promise<string | null> {
  const explicit = process.env.GOOGLE_PLACE_ID?.trim();
  if (explicit) return explicit;
  if (placeIdCache && Date.now() - placeIdCache.at < 7 * 24 * 60 * 60 * 1000) return placeIdCache.id;

  const query = process.env.GOOGLE_PLACE_QUERY?.trim() || DEFAULT_QUERY;
  const id = await findPlaceId(apiKey, query);
  placeIdCache = { at: Date.now(), id };
  if (!id) console.warn(`[google-reviews] no se pudo resolver el Place ID de: ${query}`);
  return id;
}

export async function getGoogleReviews(): Promise<GoogleReviewsResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const placeUrl =
    "https://www.google.com/maps/place/C%C3%B3rdoba+Digital/@-31.4161969,-64.1907175,17z/data=!4m8!3m7!1s0x9432a28115e2c229:0x58bf252ddc34e7a7!8m2!3d-31.416308!4d-64.186793";

  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (!apiKey) {
    return { rating: null, count: null, reviews: [], fallback: true, placeUrl };
  }

  const placeId = await resolvePlaceId(apiKey);
  if (!placeId) {
    return { rating: null, count: null, reviews: [], fallback: true, placeUrl };
  }

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          // `review` (singular) pide las reseñas; `reviews` devuelve solo la
          // lista de URLs, así que la API actual necesita este campo.
          "X-Goog-FieldMask": "rating,userRatingCount,review,googleMapsUri",
        },
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) throw new Error(`places ${res.status}`);
    const data = (await res.json()) as {
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
      review?: {
        authorAttribution?: { displayName?: string };
        rating?: number;
        text?: { text?: string };
        publishTime?: string;
        uri?: string;
      }[];
    };
    const reviews: GoogleReview[] = (data.review ?? [])
      // Google ordena por más recientes y hasta 5 por lugar: mezclamos con las
      // mejor puntuadas para no mostrar siempre las mismas tres.
      .filter((r) => (r.text?.text ?? "").trim().length > 0)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 6)
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? "Cliente de Google",
        rating: Math.max(1, Math.min(5, Math.round(r.rating ?? 5))),
        text: (r.text?.text ?? "").trim(),
        time: r.publishTime,
        source: "google" as const,
      }));
    const result: GoogleReviewsResult = {
      rating: data.rating ?? null,
      count: data.userRatingCount ?? null,
      reviews,
      fallback: reviews.length === 0,
      placeUrl: data.googleMapsUri ?? placeUrl,
    };
    cache = { at: Date.now(), data: result };
    return result;
  } catch (error) {
    console.warn("[google-reviews] sin reseñas:", error);
    return { rating: null, count: null, reviews: [], fallback: true, placeUrl };
  }
}
