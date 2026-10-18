import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminPhotoReview } from "@/components/admin-photo-review";
import { AdminPhotoSuggestions } from "@/components/admin-photo-suggestions";
import { AdminWpImagesCopy } from "@/components/admin-wp-images-copy";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { SMALL_PHOTO_PX } from "@/lib/image-dimensions";
import { photoCheckStatus } from "@/lib/photo-checks";
import { listPendingSuggestions } from "@/lib/photo-suggestions";
import { wpImageStatus } from "@/lib/wp-image-migration";

export const dynamic = "force-dynamic";

const STORE_LABEL: Record<string, string> = { blob: "Vercel Blob", r2: "Cloudflare R2" };

export default async function AdminPhotosPage() {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) redirect("/admin/login?next=/admin/fotos");
  const [review, status, suggestions] = await Promise.all([
    photoCheckStatus(),
    wpImageStatus(),
    listPendingSuggestions(),
  ]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <p className="text-[13px] text-adm-muted">Catálogo</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Fotos</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Encontrá los productos sin foto, con fotos chicas o con fotos que marcaste para cambiar. Cada número abre la
            lista de productos ya filtrada.
          </p>
        </div>
        <AdminPhotoReview status={review} smallPx={SMALL_PHOTO_PX} />
      </section>

      {suggestions.length ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-adm-fg">Fotos sugeridas ({suggestions.length})</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-500">
              Fotos oficiales de los fabricantes para productos con foto chica o sin foto. Compará con la actual y
              tocá <strong>Usar esta foto</strong> si es el mismo producto: pasa a ser la principal y la anterior queda
              segunda. Si no corresponde, <strong>Descartar</strong>.
            </p>
          </div>
          <AdminPhotoSuggestions items={suggestions} />
        </section>
      ) : null}

      {status.pendingProducts > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-adm-fg">Fotos del WordPress</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-500">
              Copia a nuestro almacenamiento las fotos de producto que todavía se cargan desde el WordPress viejo, para
              poder apagarlo. Se achican a WebP como las que subís desde el panel. Se puede cortar y retomar: lo ya
              copiado no se repite.
            </p>
          </div>
          <AdminWpImagesCopy
            store={status.store ? STORE_LABEL[status.store] : null}
            pendingProducts={status.pendingProducts}
            pendingImages={status.pendingImages}
          />
        </section>
      ) : null}
    </div>
  );
}
