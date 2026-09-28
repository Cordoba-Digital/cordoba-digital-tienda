"use client";

import { useEffect, useState } from "react";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

/** Counts down to the end of the current day (rolling daily offer). */
export function Countdown({ label = "Termina en" }: { label?: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      setRemaining(Math.max(0, end.getTime() - now.getTime()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours = remaining === null ? 0 : Math.floor(remaining / 3_600_000);
  const minutes = remaining === null ? 0 : Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = remaining === null ? 0 : Math.floor((remaining % 60_000) / 1000);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</span>
      <div className="flex items-center gap-1">
        {[hours, minutes, seconds].map((unit, index) => (
          <span key={index} className="flex items-center gap-1">
            <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-ink-900 px-1.5 text-sm font-bold tabular-nums text-white">
              {remaining === null ? "--" : pad(unit)}
            </span>
            {index < 2 ? <span className="font-bold text-ink-400">:</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
