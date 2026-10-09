import { readUploadedImage } from "@/lib/product-images";

export const dynamic = "force-dynamic";

/**
 * Sirve una foto subida desde el admin: `/imagenes/<producto>-<id>.webp`. Solo
 * cuenta el id (el nombre es para Google). El archivo no cambia: caché de un año.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = /([a-f0-9]{24})\.[a-z]+$/.exec(file)?.[1] ?? "";
  const image = await readUploadedImage(id);
  if (!image) return new Response("No encontrada", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
