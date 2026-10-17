"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminImageManager } from "@/components/admin-image-manager";
import { AdminSpecsEditor, type SpecRow } from "@/components/admin-specs-editor";
import { ProductImg } from "@/components/product-img";
import { guessFromName, suggestSeo, type NameGuess } from "@/lib/admin-product-autofill";
import type { AdminCategoryOption, AdminProductEditData, SimilarProduct } from "@/lib/admin-products";
import { groupCategoryOptions } from "@/lib/category-tree";
import { money } from "@/lib/format";

const inputCls =
  "w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-400";
const labelCls = "mb-1 block text-xs font-semibold text-ink-600";
const sectionCls = "rounded-lg border border-ink-100 bg-surface p-5 space-y-4";
const sectionTitleCls = "text-sm font-bold text-ink-900";

/** "a", "a y b", "a, b y c". */
function listJoin(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Contador de caracteres que se pone ámbar al pasarse de lo que Google muestra. */
function Counter({ value, max }: { value: string; max: number }) {
  const n = value.length;
  return <span className={`text-[11px] tabular-nums ${n > max ? "font-semibold text-amber-700" : "text-ink-400"}`}>{n}/{max}</span>;
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** Muestra el precio con puntos de miles (120000 → 120.000); el estado guarda solo dígitos. */
function withDots(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type AutoField = "brand" | "model" | "storage" | "ram" | "condition";

export function AdminProductForm({
  categories,
  initial,
  knownBrands = [],
}: {
  categories: AdminCategoryOption[];
  /** Marcas del catálogo, para reconocerlas en el nombre (solo en el alta). */
  knownBrands?: string[];
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
  const [descriptionHtml, setDescriptionHtml] = useState(initial?.descriptionHtml ?? "");
  // También cuando el alta copió la descripción de un producto migrado ("Usar como base").
  const [hasHtml, setHasHtml] = useState(Boolean(initial?.descriptionHtml));
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

  const formRef = useRef<HTMLFormElement>(null);

  // Autocompletado del alta: lo último que se completó solo, por campo. Un campo
  // se sigue actualizando con el nombre mientras nadie lo haya cambiado a mano.
  const [auto, setAuto] = useState<Partial<Record<AutoField, string>>>({});
  const [guess, setGuess] = useState<NameGuess | null>(null);

  function onNameChange(next: string) {
    setName(next);
    if (editing) return;
    const g = guessFromName(next, knownBrands);
    setGuess(g);
    const current: Record<AutoField, string> = { brand, model, storage, ram, condition };
    const setters: Record<AutoField, (v: string) => void> = {
      brand: setBrand,
      model: setModel,
      storage: setStorage,
      ram: setRam,
      condition: (v) => setCondition(v === "Usado" ? "Usado" : "Nuevo"),
    };
    const nextAuto: Partial<Record<AutoField, string>> = {};
    for (const field of Object.keys(setters) as AutoField[]) {
      const value = field === "condition" ? g.condition || "Nuevo" : g[field];
      const untouched = field === "condition" ? current.condition === (auto.condition ?? "Nuevo") : current[field] === "" || current[field] === auto[field];
      if (!untouched) continue;
      setters[field](value);
      if (value && !(field === "condition" && value === "Nuevo")) nextAuto[field] = value;
      else if (field === "condition") nextAuto.condition = "Nuevo";
    }
    setAuto(nextAuto);
  }
  const autoLabels = (
    [
      ["brand", "marca"],
      ["model", "modelo"],
      ["storage", "memoria"],
      ["ram", "RAM"],
    ] as const
  )
    .filter(([field]) => auto[field] && { brand, model, storage, ram }[field] === auto[field])
    .map(([, label]) => label as string);
  if (auto.condition === "Usado" && condition === "Usado") autoLabels.push("estado");

  // Productos parecidos ya cargados (solo en el alta), para copiar su ficha.
  const [similar, setSimilar] = useState<SimilarProduct[]>([]);
  const [baseFrom, setBaseFrom] = useState<{ name: string; copied: string[] } | null>(null);
  useEffect(() => {
    if (editing || baseFrom) return;
    const query = name.trim();
    if (query.length < 5) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/products/parecidos?nombre=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = (await res.json().catch(() => ({}))) as { items?: SimilarProduct[] };
        setSimilar(data.items ?? []);
      } catch {
        /* sin sugerencias: no pasa nada */
      }
    }, 500);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [name, editing, baseFrom]);

  /** Copia de un producto parecido lo que no depende de la variante, sin pisar lo ya cargado. */
  function applyBase(p: SimilarProduct) {
    const copied: string[] = [];
    if (!brand.trim() && p.brand) setBrand(p.brand);
    if (!categorySlug && p.categorySlug) {
      setCategorySlug(p.categorySlug);
      copied.push("categoría");
    }
    if (!secondary.length && p.secondaryCategorySlugs?.length) setSecondary(p.secondaryCategorySlugs);
    if (!specs.length && p.specs?.length) {
      setSpecs(p.specs);
      copied.push(`${p.specs.length} características`);
    }
    if (!highlights.trim() && p.highlights?.length) {
      setHighlights(p.highlights.join("\n"));
      copied.push("destacados");
    }
    if (!shortDescription.trim() && p.shortDescription) {
      setShortDescription(p.shortDescription);
      copied.push("descripción corta");
    }
    if (!description.trim() && !descriptionHtml.trim() && (p.description || p.descriptionHtml)) {
      setDescription(p.description ?? "");
      if (p.descriptionHtml) {
        setDescriptionHtml(p.descriptionHtml);
        setHasHtml(true);
      }
      copied.push("descripción");
    }
    if (!tags.trim() && p.tags?.length) setTags(p.tags.join(", "));
    if (p.warrantyMonths) setWarrantyMonths(String(p.warrantyMonths));
    if (!weight.trim() && p.weight) setWeight(p.weight);
    if (!dimensions.trim() && p.dimensions) setDimensions(p.dimensions);
    if ((!weight.trim() && p.weight) || (!dimensions.trim() && p.dimensions)) copied.push("peso y medidas");
    setBaseFrom({ name: p.name, copied });
    setSimilar([]);
    setDirty(true);
    setSaved(false);
  }

  // Lo mínimo para que el producto se pueda crear (lo mismo que pide el servidor).
  const missing = [
    !name.trim() && "nombre",
    !brand.trim() && "marca",
    !Number(price) && "precio",
    !categorySlug && "categoría principal",
  ].filter((x): x is string => Boolean(x));

  // Avisa antes de salir de la página con cambios sin guardar.
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  // Ctrl+S / Cmd+S guarda sin ir hasta el botón.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      setDirty(false);
      // Arriba de todo, donde está el aviso de "Producto creado".
      window.scrollTo({ top: 0 });
      router.push(`/admin/productos/${encodeURIComponent(data.slug)}?creado=1`);
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
      ref={formRef}
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
              <input id="p-nombre" value={name} onChange={(e) => onNameChange(e.target.value)} required maxLength={200} placeholder="Ej. Samsung Galaxy A56 5G 256 GB 8 GB RAM" className={inputCls} />
              {!editing ? (
                <p className="mt-1 text-xs text-ink-500">Marca, modelo y variante, con las memorias así: “256 GB” y “8 GB RAM”. Con eso completamos los campos de abajo.</p>
              ) : null}
              {!editing && guess?.cleanName ? (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                  Sugerencia: <strong className="text-ink-900">{guess.cleanName}</strong>
                  <button type="button" onClick={() => onNameChange(guess.cleanName)} className="rounded-md border border-ink-200 bg-surface px-2 py-0.5 font-bold text-ink-700 hover:border-ink-400">
                    Usar este nombre
                  </button>
                </p>
              ) : null}
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
                <input id="p-memoria" value={storage} onChange={(e) => setStorage(e.target.value)} maxLength={100} placeholder="Ej. 128 GB" className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-ram" className={labelCls}>RAM</label>
                <input id="p-ram" value={ram} onChange={(e) => setRam(e.target.value)} maxLength={100} placeholder="Ej. 8 GB" className={inputCls} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
                  <input type="checkbox" checked={isUnlocked} onChange={(e) => setIsUnlocked(e.target.checked)} className="h-4 w-4 accent-ink-900" />
                  Liberado
                </label>
              </div>
            </div>
            {autoLabels.length ? (
              <p className="text-xs text-emerald-700">Completamos {listJoin(autoLabels)} a partir del nombre. Si algo no va, cambialo.</p>
            ) : null}
            {!editing && similar.length ? (
              <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
                <p className="text-sm font-semibold text-ink-900">Ya tenés productos parecidos cargados</p>
                <p className="text-xs text-ink-600">Usá uno como base para copiar categoría, características y descripción. Precio, stock, fotos y memorias no se copian.</p>
                <ul className="mt-2 space-y-1.5">
                  {similar.map((p) => (
                    <li key={p.slug} className="flex items-center gap-2">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-white">
                        <ProductImg src={p.image} alt="" sizes="36px" className="h-full w-full object-contain" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{p.name}</span>
                      <button type="button" onClick={() => applyBase(p)} className="shrink-0 rounded-md bg-ink-900 px-2.5 py-1 text-xs font-bold text-white hover:bg-ink-800">
                        Usar como base
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {baseFrom ? (
              <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Copiamos de <strong>{baseFrom.name}</strong>
                {baseFrom.copied.length ? `: ${listJoin(baseFrom.copied)}` : " (ya tenías todo cargado)"}. Revisá que aplique a este producto.
              </p>
            ) : null}
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
            <div>
              <h2 className={sectionTitleCls}>Google</h2>
              <p className="mt-0.5 text-xs text-ink-500">Opcional. Si lo dejás vacío, se usan el nombre y la descripción corta.</p>
            </div>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => {
                const seo = suggestSeo({ name, shortDescription, condition });
                setSeoTitle(seo.title);
                setSeoDescription(seo.description);
                setDirty(true);
                setSaved(false);
              }}
              className="self-start rounded-md border border-ink-200 bg-surface px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-ink-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Escribir los textos por mí
            </button>
            <div className="rounded-lg border border-[#dadce0] bg-[#fff] p-3" aria-label="Vista previa en Google">
              <p className="truncate text-xs text-[#4d5156]">cordobadigital.net › producto</p>
              <p className="truncate text-base text-[#1a0dab]">{(seoTitle.trim() || name.trim() || "Nombre del producto")} · Córdoba Digital</p>
              <p className="line-clamp-2 text-xs text-[#4d5156]">
                {seoDescription.trim() || shortDescription.trim() || "Sin descripción corta: Google muestra solo el nombre. Completá la descripción corta o esta."}
              </p>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="p-seo-t" className={labelCls}>Título para Google</label>
                <Counter value={seoTitle} max={45} />
              </div>
              <input id="p-seo-t" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={200} placeholder={name.trim() || undefined} className={inputCls} />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="p-seo-d" className={labelCls}>Descripción para Google</label>
                <Counter value={seoDescription} max={160} />
              </div>
              <textarea id="p-seo-d" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} maxLength={300} placeholder={shortDescription.trim() || undefined} className={inputCls} />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className={sectionCls} aria-label="Vista previa">
            <h2 className={sectionTitleCls}>Así se ve en la tienda</h2>
            <div className="flex gap-3">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-white">
                <ProductImg key={images[0] ?? "vacia"} src={images[0] ?? ""} alt="" sizes="96px" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{brand.trim() || "Marca"}</p>
                <p className="line-clamp-2 text-sm font-semibold text-ink-900">{name.trim() || "Nombre del producto"}</p>
                <p className="mt-1 text-base font-black text-ink-900">{Number(price) ? money(Number(price)) : "$ —"}</p>
                {discount !== null ? (
                  <p className="text-xs text-ink-500">
                    <span className="line-through">{money(Number(compareAtPrice))}</span>{" "}
                    <span className="font-bold text-emerald-700">{discount}% OFF</span>
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-1">
                  {badge.trim() ? <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white">{badge.trim()}</span> : null}
                  {stock.trim() === "" || Number(stock) === 0 ? (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-600">Sin stock</span>
                  ) : null}
                </div>
              </div>
            </div>
            {images.length === 0 ? <p className="text-xs text-amber-700">Sin foto: en la tienda se ve un recuadro gris.</p> : null}
          </section>

          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Precio</h2>
            <div>
              <label htmlFor="p-precio" className={labelCls}>Precio *</label>
              <input id="p-precio" value={withDots(price)} onChange={(e) => setPrice(digitsOnly(e.target.value))} inputMode="numeric" required placeholder="Ej. 499.999" className={inputCls} />
            </div>
            <div>
              <label htmlFor="p-anterior" className={labelCls}>Precio anterior (tachado)</label>
              <input id="p-anterior" value={withDots(compareAtPrice)} onChange={(e) => setCompareAtPrice(digitsOnly(e.target.value))} inputMode="numeric" placeholder="Opcional" className={inputCls} />
              <p className="mt-1 text-xs text-ink-500" aria-live="polite">{discount !== null ? `Muestra ${discount}% OFF` : "Sin descuento"}</p>
            </div>
          </section>

          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Categorías</h2>
            <div>
              <label htmlFor="p-cat" className={labelCls}>Principal *</label>
              <select id="p-cat" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} required className={inputCls}>
                <option value="">Elegí una categoría…</option>
                {groupCategoryOptions(categories).map(({ group, items }) => (
                  <optgroup key={group} label={group}>
                    {items.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </optgroup>
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

      <div className="admin-save-bar fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-surface/95 backdrop-blur transition-[left] duration-200 md:left-[72px] wide:left-[248px]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {error ? <p role="alert" className="mr-auto text-sm font-semibold text-red-600">{error}</p> : null}
          {!error && saved ? <p role="status" className="mr-auto text-sm font-semibold text-emerald-700">Cambios guardados.</p> : null}
          {!error && !saved && missing.length ? (
            <p className="mr-auto text-sm text-ink-500">Para {editing ? "guardar" : "crearlo"} falta: {listJoin(missing)}.</p>
          ) : null}
          {!error && !saved && !missing.length && dirty && editing ? <p className="mr-auto text-sm text-ink-500">Tenés cambios sin guardar.</p> : null}
          {!error && !saved && !missing.length && !editing ? (
            <p className="mr-auto text-sm text-ink-500">{images.length ? "Listo para crear." : "Listo para crear. Te conviene sumar al menos una foto."}</p>
          ) : null}
          <span className="hidden text-xs text-ink-400 sm:inline">Ctrl+S</span>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-ink-900 px-6 py-2.5 text-sm font-bold text-white transition-[background-color,color,border-color,box-shadow,opacity] duration-150 hover:bg-ink-800 disabled:cursor-not-allowed"
          >
            {editing ? (saving ? "Guardando…" : "Guardar cambios") : saving ? "Creando…" : "Crear producto"}
          </button>
        </div>
      </div>
    </form>
  );
}
