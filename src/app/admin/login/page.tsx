import { Suspense } from "react";

import { AdminLoginForm } from "@/components/admin-login-form";
import { adminGoogleConfigured, adminPasswordConfigured } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm google={adminGoogleConfigured()} password={adminPasswordConfigured()} />
    </Suspense>
  );
}
