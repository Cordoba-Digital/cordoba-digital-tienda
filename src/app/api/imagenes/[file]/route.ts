import { readUploadedImage } from "@/lib/product-images";

export const dynamic = "force-dynamic";

/** Sirve una foto subida desde el admin. El id es aleatorio y el archivo no cambia: caché de un año. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = file.replace(/\.[a-z]+$/, "");
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
