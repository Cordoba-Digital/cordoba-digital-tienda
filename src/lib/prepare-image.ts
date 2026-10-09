/**
 * Achica una foto en el navegador antes de subirla: lado mayor de 1600 px y
 * WebP al 85 %. Las fotos de celular (4-8 MB) quedan en 150-400 KB, que es lo
 * que conviene servir en la tienda. Los GIF se suben tal cual (perderían la
 * animación) y si el navegador no puede leer el archivo (HEIC en Chrome, por
 * ejemplo) se manda el original y el servidor decide.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.85;

export async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  if (!blob) return file;
  // Si ya venía chica y optimizada, nos quedamos con la original.
  return scale === 1 && blob.size >= file.size ? file : blob;
}

/** Sube una foto al admin y devuelve su URL pública. */
export async function uploadProductImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", await prepareImage(file), file.name || "foto");
  const res = await fetch("/api/admin/uploads", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !data.ok || !data.url) throw new Error(data.error ?? "No se pudo subir la foto.");
  return data.url;
}
