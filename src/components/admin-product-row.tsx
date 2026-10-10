"use client";

import Link from "next/link";
import { useState } from "react";

import { ProductImg } from "@/components/product-img";
import { money } from "@/lib/format";
import type { AdminProductRow } from "@/lib/admin-products";

export function AdminProductRow({ product }: { product: AdminProductRow }) {
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
      ? { label: "Sin stock", dot: "bg-red-600", text: "text-red-600" }
      : units <= 3
        ? { label: "Pocos", dot: "bg-amber-500", text: "text-ink-700" }
        : { label: "Disponible", dot: "bg-emerald-600", text: "text-ink-700" };

  const field =
    "w-full border border-ink-200 bg-surface px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-brand-400";

  return (
    <div
      role="row"
      className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-ink-100 px-4 py-3 last:border-0 hover:bg-ink-50/50 sm:grid-cols-4 lg:grid-cols-[minmax(0,1fr)_8.5rem_6.5rem_8.5rem_6rem] lg:items-start lg:gap-4"
    >
      <div role="cell" className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-4 lg:col-span-1">
        <div className="h-12 w-12 shrink-0 overflow-hidden bg-ink-50">
          <ProductImg
            src={product.image}
            alt=""
            sizes="48px"
            width={48}
            height={48}
            className="h-12 w-12 object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900" title={product.name}>
            {product.name}
          </p>
          <p className="truncate text-xs text-ink-500">
            {product.brand} · {product.sku || "sin SKU"}
          </p>
          <p className="truncate text-xs text-ink-400">{product.categorySlug}</p>
        </div>
      </div>
      <div role="cell" className="min-w-0">
        <input
          inputMode="numeric"
          value={price.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
          className={`${field} font-bold`}
          aria-label={`Precio de ${product.name}`}
        />
        <p className="mt-0.5 truncate text-xs text-ink-500">{money(product.price)} actual</p>
      </div>
      <div role="cell" className="min-w-0">
        <input
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))}
          className={`${field} font-bold`}
          aria-label={`Stock de ${product.name}`}
        />
        <p className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${stockState.text}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${stockState.dot}`} aria-hidden />
          {stockState.label}
        </p>
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
        <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-600">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          Destacado
        </label>
      </div>
      <div role="cell" className="flex min-w-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="w-full border border-brand-700 bg-brand-700 px-3 py-2 text-xs font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-brand-800 disabled:cursor-default disabled:border-ink-200 disabled:bg-surface disabled:text-ink-400"
        >
          {saving ? "…" : saved || "Guardar"}
        </button>
        <Link
          href={`/admin/productos/${encodeURIComponent(product.slug)}`}
          className="w-full border border-ink-200 px-3 py-2 text-center text-xs font-bold text-ink-700 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:border-brand-300"
        >
          Editar
        </Link>
        {error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
