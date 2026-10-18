import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProductImg } from "@/components/product-img";
import type { ProductView } from "@/lib/product-view";

export type CategoryTile = {
  name: string;
  path: string;
  count: number;
  tagline: string;
  products: ProductView[];
};

/**
 * Vitrinas de categorías, como las de Tiendamia: una tarjeta ancha y dos
 * angostas con la foto de lo más vendido de cada categoría. Van entre las
 * filas de productos para cortar la repetición de tarjetas iguales.
 *
 * `mirror` pone la ancha a la derecha, para que dos vitrinas seguidas no se
 * vean calcadas.
 */
export function HomeTiles({ tiles, mirror = false, label }: { tiles: CategoryTile[]; mirror?: boolean; label: string }) {
  if (tiles.length < 3) return null;
  const [wide, ...narrow] = tiles.slice(0, 3);
  return (
    <section aria-label={label} className="container-xl py-4 sm:py-6">
      <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <li className={`col-span-2 ${mirror ? "lg:order-last" : ""}`}>
          <WideTile tile={wide} />
        </li>
        {narrow.map((tile) => (
          <li key={tile.path}>
            <NarrowTile tile={tile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const CARD =
  "group relative flex h-full overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg";

function eyebrow(tile: CategoryTile): string {
  return tile.tagline.trim() || `${tile.count.toLocaleString("es-AR")} productos`;
}

function SeeMore({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 transition group-hover:text-brand-800 sm:text-sm">
      Ver productos<span className="sr-only"> de {name}</span>
      <ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden />
    </span>
  );
}

function WideTile({ tile }: { tile: CategoryTile }) {
  const [main, ...rest] = tile.products;
  return (
    <Link href={`/categoria/${tile.path}`} className={`${CARD} h-40 sm:h-64`}>
      <div className="relative z-10 flex w-[46%] flex-col justify-between p-4 sm:p-6">
        <div>
          <p className="line-clamp-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500 sm:text-[11px]">{eyebrow(tile)}</p>
          <h3 className="mt-1 text-lg font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[28px]">{tile.name}</h3>
        </div>
        <SeeMore name={tile.name} />
      </div>
      <div className="relative flex flex-1 items-center justify-center gap-2 p-3 sm:p-5">
        <ProductImg
          src={main.image}
          srcSet={main.imageSrcSets[0]}
          alt={main.name}
          sizes="(max-width: 1024px) 50vw, 25vw"
          className="h-full max-h-full w-auto max-w-[70%] object-contain transition duration-300 group-hover:scale-[1.03]"
        />
        {/* Una segunda foto chica al costado, solo donde hay lugar. */}
        {rest[0] ? (
          <ProductImg
            src={rest[0].image}
            srcSet={rest[0].imageSrcSets[0]}
            alt=""
            sizes="12vw"
            className="hidden h-1/2 w-auto max-w-[30%] self-end object-contain sm:block"
          />
        ) : null}
      </div>
    </Link>
  );
}

function NarrowTile({ tile }: { tile: CategoryTile }) {
  const [main] = tile.products;
  return (
    <Link href={`/categoria/${tile.path}`} className={`${CARD} h-44 flex-col sm:h-64`}>
      <div className="px-3 pt-3 sm:px-5 sm:pt-5">
        <h3 className="line-clamp-2 text-[15px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-xl">{tile.name}</h3>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4">
        <ProductImg
          src={main.image}
          srcSet={main.imageSrcSets[0]}
          alt={main.name}
          sizes="(max-width: 1024px) 45vw, 22vw"
          className="h-full max-h-full w-auto max-w-full object-contain transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="px-3 pb-3 sm:px-5 sm:pb-5">
        <SeeMore name={tile.name} />
      </div>
    </Link>
  );
}
