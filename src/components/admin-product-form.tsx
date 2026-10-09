"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { AdminProductEditData } from "@/lib/admin-products";

const inputCls =
  "w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-xs font-bold uppercase tracking-wide text-ink-500";
const sectionCls = "card-surface space-y-4 p-5";
const sectionTitleCls = "text-sm font-black uppercase tracking-wide text-ink-900";

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

type SpecRow = { label: string; value: string };

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

  const [images, setImages] = useState<string[]>(initial?.images?.length ? initial.images : [""]);
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const [retry, setRetry] = useState<Record<number, number>>({});

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
  const [specs, setSpecs] = useState<SpecRow[]>(initial?.specs?.length ? initial.specs : [{ label: "", value: "" }]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

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
          images: images.map((u) => u.trim()).filter(Boolean),
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

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Información general</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="nuevo-nombre" className={labelCls}>Nombre *</label>
            <input id="nuevo-nombre" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="Ej. iPhone 13 128GB" className={inputCls} />
          </div>
          <div>
            <label htmlFor="nuevo-marca" className={labelCls}>Marca *</label>
            <input id="nuevo-marca" value={brand} onChange={(e) => setBrand(e.target.value)} required maxLength={100} placeholder="Ej. Apple" className={inputCls} />
          </div>
          <div>
            <label htmlFor="nuevo-modelo" className={labelCls}>Modelo</label>
            <input id="nuevo-modelo" value={model} onChange={(e) => setModel(e.target.value)} maxLength={100} className={inputCls} />
          </div>
          <div>
            <label htmlFor="nuevo-memoria" className={labelCls}>Memoria</label>
            <input id="nuevo-memoria" value={storage} onChange={(e) => setStorage(e.target.value)} maxLength={100} placeholder="Ej. 128GB" className={inputCls} />
          </div>
          <div>
            <label htmlFor="nuevo-ram" className={labelCls}>RAM</label>
            <input id="nuevo-ram" value={ram} onChange={(e) => setRam(e.target.value)} maxLength={100} placeholder="Ej. 4GB" className={inputCls} />
          </div>
          <div>
            <label htmlFor="nuevo-estado" className={labelCls}>Estado</label>
            <select id="nuevo-estado" value={condition} onChange={(e) => setCondition(e.target.value as "Nuevo" | "Usado")} className={inputCls}>
              <option value="Nuevo">Nuevo</option>
              <option value="Usado">Usado</option>
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
              <input type="checkbox" checked={isUnlocked} onChange={(e) => setIsUnlocked(e.target.checked)} className="h-4 w-4 accent-brand-700" />
              Liberado
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="nuevo-corta" className={labelCls}>Descripción corta</label>
          <textarea id="nuevo-corta" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} className={inputCls} />
        </div>
        <div>
          <label htmlFor="nuevo-desc" className={labelCls}>Descripción</label>
          <textarea id="nuevo-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputCls} />
        </div>
        {hasHtml ? (
          <div>
            <label htmlFor="nuevo-desc-html" className={labelCls}>Descripción con formato (HTML, es la que se ve en la ficha)</label>
            <textarea id="nuevo-desc-html" value={descriptionHtml} onChange={(e) => setDescriptionHtml(e.target.value)} rows={10} className={`${inputCls} font-mono text-xs`} />
            <p className="mt-1 text-xs text-ink-400">Si la vaciás, la ficha pasa a mostrar la descripción de arriba.</p>
          </div>
        ) : null}
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Ficha técnica</h2>
        <div>
          <label htmlFor="nuevo-highlights" className={labelCls}>Destacados (uno por línea)</label>
          <textarea id="nuevo-highlights" value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={4} placeholder={"Ej. Pantalla OLED 6.1\"\nCámara dual 12MP"} className={inputCls} />
        </div>
        <fieldset className="space-y-2">
          <legend className={labelCls}>Especificaciones</legend>
          {specs.map((row, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={row.label}
                onChange={(e) => setSpecs(specs.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))}
                placeholder="Dato (ej. Batería)"
                aria-label={`Dato ${index + 1}`}
                maxLength={80}
                className={`${inputCls} sm:max-w-56`}
              />
              <input
                value={row.value}
                onChange={(e) => setSpecs(specs.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))}
                placeholder="Valor (ej. 4000 mAh)"
                aria-label={`Valor ${index + 1}`}
                maxLength={300}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setSpecs(specs.length > 1 ? specs.filter((_, i) => i !== index) : [{ label: "", value: "" }])}
                aria-label={`Quitar fila ${index + 1}`}
                className="shrink-0 rounded-lg border border-ink-200 px-3 text-sm font-bold text-ink-600"
              >
                ✕
              </button>
            </div>
          ))}
          {specs.length < 40 ? (
            <button
              type="button"
              onClick={() => setSpecs([...specs, { label: "", value: "" }])}
              className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
            >
              ＋ Agregar fila
            </button>
          ) : null}
        </fieldset>
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Media</h2>
        <div className="space-y-3">
          {images.map((url, index) => {
            const trimmed = url.trim();
            const isBroken = broken[index] === true;
            return (
              <div key={index} className="rounded-xl border border-ink-100 p-3">
                <div className="flex gap-2">
                  <input
                    value={url}
                    onChange={(e) => {
                      const next = [...images];
                      next[index] = e.target.value;
                      setImages(next);
                      setBroken((prev) => ({ ...prev, [index]: false }));
                    }}
                    placeholder="https://…"
                    inputMode="url"
                    aria-label={`URL de imagen ${index + 1}`}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImages(images.filter((_, i) => i !== index));
                      setBroken((prev) => {
                        const next = { ...prev };
                        delete next[index];
                        return next;
                      });
                    }}
                    disabled={images.length <= 1}
                    aria-label={`Quitar imagen ${index + 1}`}
                    className="shrink-0 rounded-lg border border-ink-200 px-3 text-sm font-bold text-ink-600 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
                {trimmed ? (
                  isBroken ? (
                    <div className="mt-2 flex items-center gap-3">
                      <p role="alert" className="text-xs font-semibold text-rose-600">URL rota: la imagen no carga.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setBroken((prev) => ({ ...prev, [index]: false }));
                          setRetry((prev) => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));
                        }}
                        className="rounded-lg border border-ink-200 px-3 py-1 text-xs font-bold text-ink-700"
                      >
                        Probar
                      </button>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${index}-${retry[index] ?? 0}`}
                      src={trimmed}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={() => setBroken((prev) => ({ ...prev, [index]: true }))}
                      className="mt-2 h-24 w-24 rounded-lg border border-ink-100 bg-white object-contain"
                    />
                  )
                ) : null}
              </div>
            );
          })}
        </div>
        {images.length < 8 ? (
          <button
            type="button"
            onClick={() => setImages([...images, ""])}
            className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-bold text-ink-700"
          >
            ＋ Agregar imagen
          </button>
        ) : null}
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Precio</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="nuevo-precio" className={labelCls}>Precio *</label>
            <input id="nuevo-precio" value={price} onChange={(e) => setPrice(digitsOnly(e.target.value))} inputMode="numeric" required placeholder="Ej. 499999" className={inputCls} />
          </div>
          <div>
            <label htmlFor="nuevo-anterior" className={labelCls}>Precio anterior</label>
            <input id="nuevo-anterior" value={compareAtPrice} onChange={(e) => setCompareAtPrice(digitsOnly(e.target.value))} inputMode="numeric" placeholder="Opcional" className={inputCls} />
          </div>
          <div>
            <span className={labelCls}>Descuento</span>
            <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm font-bold text-ink-700" aria-live="polite">
              {discount !== null ? `${discount}% OFF` : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Inventario</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nuevo-sku" className={labelCls}>SKU</label>
            <input id="nuevo-sku" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={100} className={inputCls} />
          </div>
          <div>
            <label htmlFor="nuevo-stock" className={labelCls}>Stock</label>
            <input id="nuevo-stock" value={stock} onChange={(e) => setStock(digitsOnly(e.target.value))} inputMode="numeric" className={inputCls} />
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Envío</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nuevo-peso" className={labelCls}>Peso</label>
            <input id="nuevo-peso" value={weight} onChange={(e) => setWeight(e.target.value)} maxLength={60} placeholder="Ej. 0.4 kg" className={inputCls} />
          </div>
          <div>
            <label htmlFor="nuevo-medidas" className={labelCls}>Medidas (largo × ancho × alto)</label>
            <input id="nuevo-medidas" value={dimensions} onChange={(e) => setDimensions(e.target.value)} maxLength={100} placeholder="Ej. 20 × 12 × 6 cm" className={inputCls} />
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Categoría</h2>
        <div>
          <label htmlFor="nuevo-cat" className={labelCls}>Principal *</label>
          <select id="nuevo-cat" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} required className={inputCls}>
            <option value="">Elegí una categoría…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
        {categories.length > 0 ? (
          <fieldset>
            <legend className={labelCls}>Secundarias</legend>
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {categories.map((c) => (
                <label key={c.slug} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${secondary.includes(c.slug) ? "border-brand-700 bg-brand-700 text-white" : "border-ink-200 text-ink-600"}`}>
                  <input type="checkbox" checked={secondary.includes(c.slug)} onChange={() => toggleSecondary(c.slug)} className="sr-only" />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div>
          <label htmlFor="nuevo-tags" className={labelCls}>Etiquetas (separadas por coma)</label>
          <input id="nuevo-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ej. iphone, apple, 5g" className={inputCls} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nuevo-badge" className={labelCls}>Etiqueta visible</label>
            <input id="nuevo-badge" value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={40} placeholder="Ej. Oferta" className={inputCls} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-brand-700" />
              Destacado
            </label>
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Garantía</h2>
        <div>
          <label htmlFor="nuevo-garantia" className={labelCls}>Meses (0–60)</label>
          <input id="nuevo-garantia" value={warrantyMonths} onChange={(e) => setWarrantyMonths(digitsOnly(e.target.value))} inputMode="numeric" className={`${inputCls} sm:max-w-40`} />
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>SEO</h2>
        <div className="grid gap-3">
          <div>
            <label htmlFor="nuevo-seo-t" className={labelCls}>Título (opcional)</label>
            <input id="nuevo-seo-t" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={200} className={inputCls} />
          </div>
          <div>
            <label htmlFor="nuevo-seo-d" className={labelCls}>Descripción (opcional)</label>
            <textarea id="nuevo-seo-d" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} maxLength={300} className={inputCls} />
          </div>
        </div>
      </section>

      {error ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-800 disabled:opacity-40"
        >
          {editing ? (saving ? "Guardando…" : "Guardar cambios") : saving ? "Creando…" : "Crear producto"}
        </button>
        {saved ? (
          <p role="status" className="text-sm font-semibold text-emerald-700">
            Guardado.
          </p>
        ) : null}
      </div>
    </form>
  );
}
