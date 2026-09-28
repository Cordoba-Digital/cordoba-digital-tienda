import { getOrderByCode } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") ?? undefined;

  const result = await getOrderByCode(code, email ?? undefined);
  if (!result) {
    return Response.json(
      { ok: false, error: "No encontramos un pedido con esos datos. Revisá el código y el email." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true, order: result.order, items: result.items });
}
