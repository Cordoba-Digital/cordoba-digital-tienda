import { searchProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.trim().length < 2) return Response.json({ results: [] });
  try {
    const results = await searchProducts(q, 6);
    return Response.json({ results });
  } catch {
    return Response.json({ results: [] }, { status: 200 });
  }
}
