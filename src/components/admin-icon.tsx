import { ADMIN_ICON_PATHS, type AdminIconName } from "@/components/admin-nav-items";

/** Ícono de línea del panel; hereda el color del texto. */
export function AdminIcon({ name, className = "h-[18px] w-[18px]" }: { name: AdminIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ADMIN_ICON_PATHS[name]} />
    </svg>
  );
}
