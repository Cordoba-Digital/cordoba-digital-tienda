"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminDotBadge } from "@/components/admin-ui";
import { ProductImg } from "@/components/product-img";
import { money } from "@/lib/format";
import type { AdminProductRow } from "@/lib/admin-products";

export function AdminProductRow({ product, categoryName }: { product: AdminProductRow; categoryName?: string }) {
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(String(product.stock));
  const [featured, setFeatured] = useState(product.featured);
  const [badge, setBadge] = useState(product.badge ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const dirty =
    Number(price) !== product.price ||
    Number(stock) !== product.stock ||
    featured !== product.featured ||
    badge.trim() !== (product.badge ?? "");

  async function save() {
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(product.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: Number(price),
          stock: Number(stock),
          featured,
          badge: badge.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar.");
        return;
      }
      setSaved("✓");
      window.setTimeout(() => setSaved(""), 2000);
    } catch {
      setError("Error de red.");
    } finally {
      setSaving(false);
    }
  }

  // Estado según lo que está escrito, así se ve el cambio antes de guardar.
  const units = Number(stock) || 0;
  const stockState =
    units <= 0
      ? { label: "Sin stock", color: "#ff8a8a" }
      : units <= 3
        ? { label: `Poco stock · ${units}`, color: "#f5b544" }
        : { label: `En stock · ${units}`, color: "#6ee79a" };
  // La barrita llena se alcanza con 40 unidades; es solo una referencia visual.
  const fill = Math.min(100, (units / 40) * 100);

  const field =
    "h-9 w-full border border-ink-200 bg-surface px-3 text-sm text-ink-900 outline-none focus:border-brand-400";

  return (
    <div
      role="row"
      className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-adm-fg/[0.06] px-5 py-3.5 transition-[background-color] duration-150 hover:bg-adm-fg/[0.035] sm:grid-cols-4 lg:grid-cols-[minmax(0,1fr)_8.5rem_8rem_9rem_6.5rem] lg:items-start lg:gap-4"
    >
      <div role="cell" className="col-span-2 flex min-w-0 items-center gap-3.5 sm:col-span-4 lg:col-span-1">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-adm-fg/[0.08] bg-white">
          <ProductImg
            src={product.image}
            alt=""
            sizes="44px"
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
          />
        </div>
        <div className="min-w-0">
          <Link
            href={`/admin/productos/${encodeURIComponent(product.slug)}`}
            className="line-clamp-2 text-sm font-medium leading-snug text-adm-fg hover:text-adm-accent"
            title={product.name}
          >
            {product.name}
          </Link>
          <p className="truncate text-xs text-adm-muted">
            {product.brand} · {categoryName || product.categorySlug}
          </p>
          <p className="admin-mono truncate text-[11px] text-adm-faint">{product.sku || "sin SKU"}</p>
        </div>
      </div>
      <div role="cell" className="min-w-0">
        <input
          inputMode="numeric"
          value={price.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
          className={`${field} admin-mono`}
          aria-label={`Precio de ${product.name}`}
        />
        <p className="mt-1 truncate text-xs text-adm-faint">{money(product.price)} actual</p>
      </div>
      <div role="cell" className="min-w-0">
        <input
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))}
          className={`${field} admin-mono`}
          aria-label={`Stock de ${product.name}`}
        />
        <div className="mt-1.5">
          <AdminDotBadge color={stockState.color} className="!px-2 !py-0 text-[11px]">
            {stockState.label}
          </AdminDotBadge>
          <span className="mt-1.5 block h-[3px] w-full overflow-hidden rounded-full bg-adm-fg/[0.08]" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${fill}%`, backgroundColor: stockState.color }} />
          </span>
        </div>
      </div>
      <div role="cell" className="min-w-0">
        <input
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
          placeholder="Ej. Oferta"
          maxLength={40}
          className={field}
          aria-label={`Etiqueta de ${product.name}`}
        />
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-adm-muted">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="peer sr-only" />
          {/* Interruptor: naranja cuando el producto va destacado en la tienda. */}
          <span
            aria-hidden
            className="relative h-5 w-9 shrink-0 rounded-full bg-adm-fg/[0.12] transition-colors duration-150 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:duration-150 peer-checked:bg-brand-500 peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-adm-accent"
          />
          Destacado
        </label>
      </div>
      <div role="cell" className="flex min-w-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="h-9 w-full rounded-full bg-[linear-gradient(180deg,#ff7440,#f15a24)] px-3 text-xs font-semibold text-[#14161c] transition-[filter,opacity] duration-150 hover:brightness-110 disabled:cursor-default disabled:bg-none disabled:bg-adm-fg/[0.05] disabled:text-adm-faint"
        >
          {saving ? "…" : saved || "Guardar"}
        </button>
        <Link
          href={`/admin/productos/${encodeURIComponent(product.slug)}`}
          className="inline-flex h-9 w-full items-center justify-center rounded-full border border-adm-fg/10 bg-adm-fg/[0.04] px-3 text-xs text-adm-soft transition-[background-color] duration-150 hover:bg-adm-fg/[0.09]"
        >
          Editar
        </Link>
        {error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
