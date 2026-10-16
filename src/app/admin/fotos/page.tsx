import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminWpImagesCopy } from "@/components/admin-wp-images-copy";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyAdminSessionValue } from "@/lib/admin-session";
import { wpImageStatus } from "@/lib/wp-image-migration";

export const dynamic = "force-dynamic";

const STORE_LABEL: Record<string, string> = { blob: "Vercel Blob", r2: "Cloudflare R2" };

export default async function AdminPhotosPage() {
  const jar = await cookies();
  if (!(await verifyAdminSessionValue(jar.get(ADMIN_COOKIE)?.value))) redirect("/admin/login?next=/admin/fotos");
  const status = await wpImageStatus();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-adm-muted">Catálogo</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-adm-fg sm:text-[30px]">Fotos del WordPress</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Copia a nuestro almacenamiento las fotos de producto que todavía se cargan desde el WordPress viejo, para poder
          apagarlo. Se achican a WebP como las que subís desde el panel. Se puede cortar y retomar: lo ya copiado no se repite.
        </p>
      </div>
      <AdminWpImagesCopy
        store={status.store ? STORE_LABEL[status.store] : null}
        pendingProducts={status.pendingProducts}
        pendingImages={status.pendingImages}
      />
    </div>
  );
}
