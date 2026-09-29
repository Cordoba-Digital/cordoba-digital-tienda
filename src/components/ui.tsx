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
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "brandSolid" | "success" | "danger" | "amber" | "dark";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-100 text-ink-700",
    brand: "bg-brand-50 text-brand-700",
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-700",
    /** Sólido de marca: para pills que van sobre la foto del producto. */
    brandSolid: "bg-brand-600 text-white",
    dark: "bg-deep text-white",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${tones[tone]} ${className}`}
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
        ) : null}
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">{title}</h2>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{description}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="group inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
        >
          {action.label}
          <span className="transition group-hover:translate-x-0.5">→</span>
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
