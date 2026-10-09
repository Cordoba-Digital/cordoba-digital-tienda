"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminImageManager } from "@/components/admin-image-manager";
import { AdminSpecsEditor, type SpecRow } from "@/components/admin-specs-editor";
import type { AdminProductEditData } from "@/lib/admin-products";

const inputCls =
  "w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-400";
const labelCls = "mb-1 block text-xs font-semibold text-ink-600";
const sectionCls = "rounded-2xl border border-ink-100 bg-surface p-5 space-y-4";
const sectionTitleCls = "text-sm font-bold text-ink-900";

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function AdminProductForm({
  categories,
  initial,
}: {
  categories: { slug: string; name: string }[];
  /** Con `initial` el form edita ese producto (PUT); sin él, da de alta (POST). */
  initial?: AdminProductEditData;
}) {
  const router = useRouter();
  const editing = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [storage, setStorage] = useState(initial?.storage ?? "");
  const [ram, setRam] = useState(initial?.ram ?? "");
  const [condition, setCondition] = useState<"Nuevo" | "Usado">(initial?.condition === "Usado" ? "Usado" : "Nuevo");
  const [isUnlocked, setIsUnlocked] = useState(initial?.isUnlocked ?? true);

  const [images, setImages] = useState<string[]>(initial?.images ?? []);

  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [compareAtPrice, setCompareAtPrice] = useState(initial?.compareAtPrice ? String(initial.compareAtPrice) : "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [stock, setStock] = useState(initial ? String(initial.stock ?? 0) : "1");
  const [categorySlug, setCategorySlug] = useState(initial?.categorySlug ?? "");
  const [secondary, setSecondary] = useState<string[]>(initial?.secondaryCategorySlugs ?? []);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  // Solo los productos migrados de WooCommerce traen HTML; la ficha lo muestra
  // antes que la descripción en texto, así que se edita ese campo.
  const hasHtml = Boolean(initial?.descriptionHtml);
  const [descriptionHtml, setDescriptionHtml] = useState(initial?.descriptionHtml ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [warrantyMonths, setWarrantyMonths] = useState(String(initial?.warrantyMonths ?? 6));
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [weight, setWeight] = useState(initial?.weight ?? "");
  const [dimensions, setDimensions] = useState(initial?.dimensions ?? "");
  const [highlights, setHighlights] = useState((initial?.highlights ?? []).join("\n"));
  const [specs, setSpecs] = useState<SpecRow[]>(initial?.specs ?? []);
  const [categoryFilter, setCategoryFilter] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  // Cualquier cambio en el form apaga el "Guardado" hasta el próximo guardado.
  const [dirty, setDirty] = useState(false);

  const discount = useMemo(() => {
    const p = Number(price);
    const c = Number(compareAtPrice);
    if (!p || !c || c <= p) return null;
    return Math.round((1 - p / c) * 100);
  }, [price, compareAtPrice]);

  function toggleSecondary(slug: string) {
    setSecondary((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const url = initial ? `/api/admin/products/${encodeURIComponent(initial.slug)}` : "/api/admin/products";
      const res = await fetch(url, {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim(),
          model: model.trim(),
          storage: storage.trim(),
          ram: ram.trim(),
          condition,
          isUnlocked,
          price: Number(price),
          compareAtPrice: compareAtPrice.trim() === "" ? null : Number(compareAtPrice),
          stock: stock.trim() === "" ? 0 : Number(stock),
          sku: sku.trim(),
          categorySlug,
          secondaryCategorySlugs: secondary,
          shortDescription: shortDescription.trim(),
          description: description.trim(),
          images,
          badge: badge.trim() || null,
          featured,
          warrantyMonths: warrantyMonths.trim() === "" ? 6 : Number(warrantyMonths),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          seoTitle: seoTitle.trim(),
          seoDescription: seoDescription.trim(),
          weight: weight.trim(),
          dimensions: dimensions.trim(),
          highlights: highlights.split("\n").map((h) => h.trim()).filter(Boolean),
          specs: specs.map((r) => ({ label: r.label.trim(), value: r.value.trim() })).filter((r) => r.label || r.value),
          ...(hasHtml ? { descriptionHtml } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; slug?: string };
      if (!res.ok || !data.ok || !data.slug) {
        setError(data.error ?? (editing ? "No se pudo guardar." : "No se pudo crear el producto."));
        return;
      }
      if (editing) {
        setSaved(true);
        setDirty(false);
        router.refresh();
        return;
      }
      router.push(`/admin/productos?q=${encodeURIComponent(data.slug)}`);
    } catch {
      setError("Error de red.");
    } finally {
      setSaving(false);
    }
  }

  const mainCategoryName = categories.find((c) => c.slug === categorySlug)?.name ?? "";
  const filteredCategories = categoryFilter.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(categoryFilter.trim().toLowerCase()))
    : categories;

  return (
    <form
      onSubmit={submit}
      onChange={() => {
        setDirty(true);
        setSaved(false);
      }}
      className="space-y-4 pb-24"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Información general</h2>
            <div>
              <label htmlFor="p-nombre" className={labelCls}>Nombre *</label>
              <input id="p-nombre" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="Ej. iPhone 13 128GB" className={inputCls} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="p-marca" className={labelCls}>Marca *</label>
                <input id="p-marca" value={brand} onChange={(e) => setBrand(e.target.value)} required maxLength={100} placeholder="Ej. Apple" className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-modelo" className={labelCls}>Modelo</label>
                <input id="p-modelo" value={model} onChange={(e) => setModel(e.target.value)} maxLength={100} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-estado" className={labelCls}>Estado</label>
                <select id="p-estado" value={condition} onChange={(e) => setCondition(e.target.value as "Nuevo" | "Usado")} className={inputCls}>
                  <option value="Nuevo">Nuevo</option>
                  <option value="Usado">Usado</option>
                </select>
              </div>
              <div>
                <label htmlFor="p-memoria" className={labelCls}>Memoria</label>
                <input id="p-memoria" value={storage} onChange={(e) => setStorage(e.target.value)} maxLength={100} placeholder="Ej. 128GB" className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-ram" className={labelCls}>RAM</label>
                <input id="p-ram" value={ram} onChange={(e) => setRam(e.target.value)} maxLength={100} placeholder="Ej. 4GB" className={inputCls} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
                  <input type="checkbox" checked={isUnlocked} onChange={(e) => setIsUnlocked(e.target.checked)} className="h-4 w-4 accent-ink-900" />
                  Liberado
                </label>
              </div>
            </div>
          </section>

          <section className={sectionCls}>
            <div>
              <h2 className={sectionTitleCls}>Fotos</h2>
              <p className="mt-0.5 text-xs text-ink-500">La primera es la que se ve en el listado y en Google.</p>
            </div>
            <AdminImageManager
              images={images}
              productName={name}
              onChange={(next) => {
                setImages(next);
                setDirty(true);
                setSaved(false);
              }}
            />
          </section>

          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Descripción</h2>
            <div>
              <label htmlFor="p-corta" className={labelCls}>Descripción corta</label>
              <textarea id="p-corta" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} className={inputCls} />
            </div>
            <div>
              <label htmlFor="p-desc" className={labelCls}>Descripción</label>
              <textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={inputCls} />
            </div>
            {hasHtml ? (
              <details className="rounded-xl border border-ink-100 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-ink-700">
                  Descripción con formato (HTML migrado de WordPress, es la que se ve en la ficha)
                </summary>
                <textarea value={descriptionHtml} onChange={(e) => setDescriptionHtml(e.target.value)} rows={10} aria-label="Descripción HTML" className={`${inputCls} mt-2 font-mono text-xs`} />
                <p className="mt-1 text-xs text-ink-500">Si la vaciás, la ficha pasa a mostrar la descripción de arriba.</p>
              </details>
            ) : null}
          </section>

          <section className={sectionCls}>
            <div>
              <h2 className={sectionTitleCls}>Características</h2>
              <p className="mt-0.5 text-xs text-ink-500">Se muestran como tabla en la ficha del producto.</p>
            </div>
            <AdminSpecsEditor
              rows={specs}
              onChange={(next) => {
                setSpecs(next);
                setDirty(true);
                setSaved(false);
              }}
            />
            <div>
              <label htmlFor="p-highlights" className={labelCls}>Destacados (uno por línea, aparecen arriba de la ficha)</label>
              <textarea id="p-highlights" value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={4} placeholder={"Ej. Pantalla OLED de 6.1\"\nCámara dual de 12 MP"} className={inputCls} />
            </div>
          </section>

          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>SEO</h2>
            <div>
              <label htmlFor="p-seo-t" className={labelCls}>Título para Google (opcional)</label>
              <input id="p-seo-t" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={200} className={inputCls} />
            </div>
            <div>
              <label htmlFor="p-seo-d" className={labelCls}>Descripción para Google (opcional)</label>
              <textarea id="p-seo-d" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} maxLength={300} className={inputCls} />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Precio</h2>
            <div>
              <label htmlFor="p-precio" className={labelCls}>Precio *</label>
              <input id="p-precio" value={price} onChange={(e) => setPrice(digitsOnly(e.target.value))} inputMode="numeric" required placeholder="Ej. 499999" className={inputCls} />
            </div>
            <div>
              <label htmlFor="p-anterior" className={labelCls}>Precio anterior (tachado)</label>
              <input id="p-anterior" value={compareAtPrice} onChange={(e) => setCompareAtPrice(digitsOnly(e.target.value))} inputMode="numeric" placeholder="Opcional" className={inputCls} />
              <p className="mt-1 text-xs text-ink-500" aria-live="polite">{discount !== null ? `Muestra ${discount}% OFF` : "Sin descuento"}</p>
            </div>
          </section>

          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Inventario</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-stock" className={labelCls}>Stock</label>
                <input id="p-stock" value={stock} onChange={(e) => setStock(digitsOnly(e.target.value))} inputMode="numeric" className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-sku" className={labelCls}>SKU</label>
                <input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={100} className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="p-garantia" className={labelCls}>Garantía (meses)</label>
              <input id="p-garantia" value={warrantyMonths} onChange={(e) => setWarrantyMonths(digitsOnly(e.target.value))} inputMode="numeric" className={inputCls} />
            </div>
          </section>

          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Visibilidad</h2>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-ink-900" />
              Destacado en la home
            </label>
            <div>
              <label htmlFor="p-badge" className={labelCls}>Etiqueta visible</label>
              <input id="p-badge" value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={40} placeholder="Ej. Oferta" className={inputCls} />
            </div>
          </section>

          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Categorías</h2>
            <div>
              <label htmlFor="p-cat" className={labelCls}>Principal *</label>
              <select id="p-cat" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} required className={inputCls}>
                <option value="">Elegí una categoría…</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
            {categories.length > 0 ? (
              <fieldset>
                <legend className={labelCls}>También aparece en {secondary.length ? `(${secondary.length})` : ""}</legend>
                <input
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  placeholder="Buscar categoría…"
                  aria-label="Buscar categoría secundaria"
                  className={`${inputCls} mb-2`}
                />
                <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-ink-100 p-1" data-lenis-prevent>
                  {filteredCategories
                    .filter((c) => c.slug !== categorySlug)
                    .map((c) => (
                      <label key={c.slug} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-ink-700 hover:bg-ink-50">
                        <input type="checkbox" checked={secondary.includes(c.slug)} onChange={() => toggleSecondary(c.slug)} className="h-3.5 w-3.5 accent-ink-900" />
                        {c.name}
                      </label>
                    ))}
                </div>
                {mainCategoryName ? <p className="mt-1 text-xs text-ink-500">Principal: {mainCategoryName}</p> : null}
              </fieldset>
            ) : null}
            <div>
              <label htmlFor="p-tags" className={labelCls}>Palabras clave (separadas por coma)</label>
              <input id="p-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ej. iphone, apple, 5g" className={inputCls} />
            </div>
          </section>

          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Envío</h2>
            <div>
              <label htmlFor="p-peso" className={labelCls}>Peso</label>
              <input id="p-peso" value={weight} onChange={(e) => setWeight(e.target.value)} maxLength={60} placeholder="Ej. 0.4 kg" className={inputCls} />
            </div>
            <div>
              <label htmlFor="p-medidas" className={labelCls}>Medidas (largo × ancho × alto)</label>
              <input id="p-medidas" value={dimensions} onChange={(e) => setDimensions(e.target.value)} maxLength={100} placeholder="Ej. 20 × 12 × 6 cm" className={inputCls} />
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-surface/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {error ? <p role="alert" className="mr-auto text-sm font-semibold text-rose-600">{error}</p> : null}
          {!error && saved ? <p role="status" className="mr-auto text-sm font-semibold text-emerald-700">Cambios guardados.</p> : null}
          {!error && !saved && dirty && editing ? <p className="mr-auto text-sm text-ink-500">Tenés cambios sin guardar.</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-ink-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-40"
          >
            {editing ? (saving ? "Guardando…" : "Guardar cambios") : saving ? "Creando…" : "Crear producto"}
          </button>
        </div>
      </div>
    </form>
  );
}
