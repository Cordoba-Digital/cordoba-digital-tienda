/** Barra de rayitas: `value` de `total`, pintadas con `color` y el resto en gris. */
export function AdminTickMeter({ value, total, color, ticks = 44 }: { value: number; total: number; color: string; ticks?: number }) {
  const filled = total > 0 ? Math.round((Math.min(value, total) / total) * ticks) : 0;
  return (
    <div className="flex h-7 items-stretch justify-between gap-[3px]" aria-hidden="true">
      {Array.from({ length: ticks }, (_, i) => (
        <span key={i} className="w-[2px] rounded-full" style={{ backgroundColor: i < filled ? color : "var(--color-ink-100)" }} />
      ))}
    </div>
  );
}
