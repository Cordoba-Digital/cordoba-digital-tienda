export const dynamic = "force-dynamic";

import { getGoogleReviews } from "@/lib/google-reviews";

export async function GET() {
  const data = await getGoogleReviews();
  return Response.json({ ok: true, ...data });
}
