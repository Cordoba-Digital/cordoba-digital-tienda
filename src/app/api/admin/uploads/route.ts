import { sessionFromCookieHeader, verifyAdminSessionValue } from "@/lib/admin-auth";
import { MAX_UPLOAD_BYTES, importRemoteImage, saveUploadedImage } from "@/lib/product-images";

export const dynamic = "force-dynamic";

/**
 * Guarda una foto de producto y devuelve su URL. Acepta un archivo (multipart,
 * campos `file` y `name`) o una foto de otra web (JSON `{ url, name }`), que se
 * descarga para no depender de ese sitio. `name` es el del producto.
 */
export async function POST(request: Request) {
  if (!(await verifyAdminSessionValue(sessionFromCookieHeader(request.headers.get("cookie"))))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { url?: unknown; name?: unknown };
    if (typeof body.url !== "string") return Response.json({ ok: false, error: "Falta la URL." }, { status: 400 });
    const result = await importRemoteImage(body.url, typeof body.name === "string" ? body.name : "");
    return Response.json(result, { status: result.ok ? 200 : 400 });
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
  const name = form?.get("name");
  const result = await saveUploadedImage(Buffer.from(await file.arrayBuffer()), typeof name === "string" ? name : "");
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
