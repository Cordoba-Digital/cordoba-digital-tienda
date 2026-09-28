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

export async function getGoogleReviews(): Promise<GoogleReviewsResult> {
  const placeId = process.env.GOOGLE_PLACE_ID?.trim();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const placeUrl = placeId
    ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`
    : "https://maps.google.com/?q=27+de+Abril+259+Córdoba+Argentina";

  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (!placeId || !apiKey) {
    return { rating: null, count: null, reviews: [], fallback: true, placeUrl };
  }

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri",
        },
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) throw new Error(`places ${res.status}`);
    const data = (await res.json()) as {
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
      reviews?: { authorAttribution?: { displayName?: string }; rating?: number; text?: { text?: string }; publishTime?: string }[];
    };
    const reviews: GoogleReview[] = (data.reviews ?? []).slice(0, 6).map((r) => ({
      author: r.authorAttribution?.displayName ?? "Cliente de Google",
      rating: Math.max(1, Math.min(5, Math.round(r.rating ?? 5))),
      text: r.text?.text ?? "",
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
