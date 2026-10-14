import Link from "next/link";
import type { ReactNode } from "react";

export function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const value = rating / 10;
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const dim = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400" aria-label={`${value} de 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < full;
        const isHalf = !filled && i === full && half;
        return (
          <svg key={i} viewBox="0 0 20 20" className={dim} aria-hidden>
            <defs>
              <linearGradient id={`half-${i}`}>
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
              fill={filled ? "currentColor" : isHalf ? `url(#half-${i})` : "#e2e8f0"}
            />
          </svg>
        );
      })}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className = "",
  solid = false,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "brandSolid" | "success" | "danger" | "amber" | "dark";
  className?: string;
  /** Colores plenos en vez de fondos claros (lo usa el panel admin). */
  solid?: boolean;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-100 text-ink-700",
    brand: "bg-brand-50 text-brand-700",
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    /** Sólido de marca: para pills que van sobre la foto del producto. */
    brandSolid: "bg-brand-700 text-white",
    dark: "bg-deep text-white",
  };
  const solidTones: Record<string, string> = {
    neutral: "bg-ink-700 text-white",
    brand: "bg-brand-700 text-white",
    success: "bg-emerald-600 text-white",
    danger: "bg-red-600 text-white",
    amber: "bg-amber-500 text-ink-900",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${(solid && solidTones[tone]) || tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    // En el celular, título chico en una línea con su enlace al costado (como en
    // Mercado Libre): la volanta y la bajada se guardan para pantallas grandes.
    <div className="mb-3 flex items-end justify-between gap-3 sm:mb-6 sm:flex-wrap sm:gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700 sm:block">{eyebrow}</p>
        ) : null}
        <h2 className="text-lg font-extrabold leading-tight tracking-tight text-ink-900 sm:mt-1 sm:text-3xl">{title}</h2>
        {description ? <p className="mt-1.5 hidden max-w-xl text-sm leading-relaxed text-ink-500 sm:block">{description}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-brand-700 transition hover:text-brand-800 sm:text-sm sm:font-semibold sm:text-ink-900 sm:hover:text-brand-700"
        >
          {action.label}
          <span className="transition group-hover:translate-x-0.5" aria-hidden>
            →
          </span>
        </Link>
      ) : null}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
