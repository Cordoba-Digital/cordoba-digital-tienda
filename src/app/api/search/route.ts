import { searchProducts, searchShortcuts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.trim().length < 2) return Response.json({ results: [], shortcuts: [] });
  try {
    const [results, shortcuts] = await Promise.all([searchProducts(q, 6), searchShortcuts(q).catch(() => [])]);
    return Response.json({ results, shortcuts });
  } catch {
    return Response.json({ results: [], shortcuts: [] }, { status: 200 });
  }
}
