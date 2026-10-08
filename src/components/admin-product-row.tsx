"use client";

import { useState } from "react";

import { ProductImg } from "@/components/product-img";
import { Pill } from "@/components/ui";
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

  return (
    <tr className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <ProductImg
            src={product.image}
            alt=""
            sizes="48px"
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900" title={product.name}>
              {product.name}
            </p>
            <p className="text-xs text-ink-500">
              {product.brand} · {product.sku || "sin SKU"}
            </p>
            <p className="text-xs text-ink-400">{product.categorySlug}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-28 rounded-lg border border-ink-200 bg-surface px-2 py-1.5 text-sm font-bold text-ink-900 outline-none focus:border-brand-400"
          aria-label={`Precio de ${product.name}`}
        />
        <p className="mt-0.5 text-xs text-ink-500">{money(product.price)} actual</p>
      </td>
      <td className="px-4 py-3">
        <input
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-20 rounded-lg border border-ink-200 bg-surface px-2 py-1.5 text-sm font-bold text-ink-900 outline-none focus:border-brand-400"
          aria-label={`Stock de ${product.name}`}
        />
        {product.stock <= 0 ? (
          <p className="mt-0.5">
            <Pill tone="danger">Sin stock</Pill>
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <input
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
          placeholder="Ej. Oferta"
          maxLength={40}
          className="w-28 rounded-lg border border-ink-200 bg-surface px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-brand-400"
          aria-label={`Etiqueta de ${product.name}`}
        />
        <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-600">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          Destacado
        </label>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-800 disabled:opacity-40"
        >
          {saving ? "…" : saved || "Guardar"}
        </button>
        {error ? <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">{error}</p> : null}
      </td>
    </tr>
  );
}
