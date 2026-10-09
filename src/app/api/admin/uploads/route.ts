import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { MAX_UPLOAD_BYTES, saveUploadedImage } from "@/lib/product-images";

export const dynamic = "force-dynamic";

/** Sube una foto de producto (campo `file` de un multipart). Devuelve su URL. */
export async function POST(request: Request) {
  if (!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ ok: false, error: "La foto supera los 4 MB." }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "Falta el archivo." }, { status: 400 });
  }
  const result = await saveUploadedImage(Buffer.from(await file.arrayBuffer()));
  if (!result.ok) return Response.json(result, { status: 400 });
  return Response.json(result);
}
