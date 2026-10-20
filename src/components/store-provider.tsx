"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { trackAddToCart } from "@/lib/analytics";
import { MAX_QTY_PER_ITEM } from "@/lib/pricing";

export type CartItem = {
  slug: string;
  name: string;
  brand: string;
  image: string;
  /**
   * Variantes de WooCommerce para que el navegador elija según el ancho.
   * Opcional: los ítems guardados en localStorage antes de este cambio no lo
   * tienen, y `/api/cart/validate` lo repone al recargar.
   */
  imageSrcSet?: string[];
  price: number;
  compareAtPrice: number | null;
  stock: number;
  quantity: number;
  freeShipping: boolean;
};

export type ToastMessage = { id: number; title: string; description?: string; tone: "success" | "info" | "error" };

type StoreState = {
  items: CartItem[];
  favorites: string[];
  recentlyViewed: string[];
  hydrated: boolean;
  cartOpen: boolean;
  toasts: ToastMessage[];
  /** Último agregado: el panel lo resalta y `at` reinicia la animación. */
  lastAdded: { slug: string; at: number } | null;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number, options?: { silent?: boolean; open?: boolean }) => void;
  removeItem: (slug: string) => void;
  setQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  toggleFavorite: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
  pushRecent: (slug: string) => void;
  clearRecent: () => void;
  openCart: () => void;
  closeCart: () => void;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  subtotal: number;
  listSubtotal: number;
  count: number;
};

const StoreContext = createContext<StoreState | null>(null);

/**
 * El mismo estado, pero para leer una parte con `useStoreSelector`: quien lo
 * usa se vuelve a dibujar solo cuando cambia lo que eligió. Con `useStore`,
 * cualquier aviso, abrir el carrito o tocar un favorito redibujaba todas las
 * tarjetas de producto de la página.
 */
type StoreSnapshot = { get: () => StoreState; subscribe: (listener: () => void) => () => void };
const SnapshotContext = createContext<StoreSnapshot | null>(null);

const CART_KEY = "cd_cart_v1";
const FAV_KEY = "cd_fav_v1";
const RECENT_KEY = "cd_recent_v1";

function readJSON(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Escribe sin romper la tienda: con el almacenamiento bloqueado (Chrome con
 * "bloquear todas las cookies") o lleno, `setItem` tira, y un error dentro de
 * un efecto del provider, que está en el layout, tiraba abajo todo el sitio.
 */
function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento el carrito vive hasta recargar */
  }
}

function readStrings(key: string): string[] {
  const parsed = readJSON(key);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
}

/**
 * El carrito guardado, ítem por ítem: uno sin precio o sin cantidad válida
 * se descarta, en vez de dejar el subtotal en NaN. Un dato corrupto hace
 * empezar con el carrito vacío, no romperlo.
 */
function readCart(): CartItem[] {
  const parsed = readJSON(CART_KEY);
  if (!Array.isArray(parsed)) return [];
  const isInt = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  return parsed.flatMap((raw): CartItem[] => {
    const item = raw as Partial<CartItem> | null;
    if (!item || typeof item.slug !== "string" || !item.slug || typeof item.name !== "string") return [];
    if (!isInt(item.price) || item.price < 0 || !isInt(item.quantity) || item.quantity <= 0 || !isInt(item.stock)) return [];
    return [
      {
        slug: item.slug,
        name: item.name,
        brand: typeof item.brand === "string" ? item.brand : "",
        image: typeof item.image === "string" ? item.image : "",
        imageSrcSet: Array.isArray(item.imageSrcSet) ? item.imageSrcSet.filter((v): v is string => typeof v === "string") : undefined,
        price: item.price,
        compareAtPrice: isInt(item.compareAtPrice) ? item.compareAtPrice : null,
        stock: item.stock,
        quantity: item.quantity,
        freeShipping: item.freeShipping === true,
      },
    ];
  });
}

// El `stock` migrado es disponibilidad, no cantidad (1 = hay, 0 = no hay,
// porque la Store API pública no expone cantidades). El tope real es
// MAX_QTY_PER_ITEM; el `stock` solo recorta cuando la cantidad es conocida
// (> 1) y menor que ese tope.
function clampQty(stock: number, quantity: number): number {
  if (stock <= 0) return 0;
  const qty = Math.max(1, Math.floor(quantity));
  const cap = stock > 1 ? Math.min(stock, MAX_QTY_PER_ITEM) : MAX_QTY_PER_ITEM;
  return Math.min(cap, qty);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastAdded, setLastAdded] = useState<StoreState["lastAdded"]>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setItems(readCart());
      setFavorites(readStrings(FAV_KEY));
      setRecentlyViewed(readStrings(RECENT_KEY));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJSON(CART_KEY, items);
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeJSON(FAV_KEY, favorites);
  }, [favorites, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeJSON(RECENT_KEY, recentlyViewed);
  }, [recentlyViewed, hydrated]);

  useEffect(() => {
    if (!cartOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [cartOpen]);

  const pushToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const addItem: StoreState["addItem"] = useCallback(
    (item, quantity = 1, options) => {
      setLastAdded({ slug: item.slug, at: Date.now() });
      setItems((prev) => {
        const existing = prev.find((i) => i.slug === item.slug);
        if (existing) {
          const nextQty = clampQty(existing.stock, existing.quantity + quantity);
          return prev.map((i) => (i.slug === item.slug ? { ...i, quantity: nextQty } : i));
        }
        return [...prev, { ...item, quantity: clampQty(item.stock, quantity) }];
      });
      trackAddToCart({
        item_id: item.slug,
        item_name: item.name,
        item_brand: item.brand,
        price: item.price,
        quantity: clampQty(item.stock, quantity),
      });
      // Si se abre el carrito, el propio panel confirma el agregado: el aviso
      // sobraría y en la esquina inferior derecha tapaba "Finalizar compra".
      if (options?.open !== false) setCartOpen(true);
      else if (!options?.silent) {
        pushToast({ title: "Agregado al carrito", description: item.name, tone: "success" });
      }
    },
    [pushToast],
  );

  const removeItem = useCallback((slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.slug === slug ? { ...i, quantity: clampQty(i.stock, quantity) } : i))
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  // Espejo de `favorites` para lectura sincrónica en el toggle. Se sincroniza
  // en efecto (el único lugar donde el linter permite escribir refs): entre
  // dos clicks discretos React ya flusheó los efectos, así que la lectura
  // está al día. Sin esto habría que leer `favorites` del closure y el
  // callback se recrearía (y re-renderizaría suscriptos) en cada cambio.
  const favoritesRef = useRef<string[]>([]);
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);
  const toggleFavorite = useCallback(
    (slug: string) => {
      const exists = favoritesRef.current.includes(slug);
      setFavorites((prev) =>
        prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
      );
      pushToast({ title: exists ? "Quitado de favoritos" : "Guardado en favoritos", tone: "info" });
    },
    [pushToast],
  );

  const pushRecent = useCallback((slug: string) => {
    setRecentlyViewed((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, 8));
  }, []);

  const clearRecent = useCallback(() => setRecentlyViewed([]), []);
  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const value = useMemo<StoreState>(() => {
    const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const listSubtotal = items.reduce((acc, i) => acc + (i.compareAtPrice ?? i.price) * i.quantity, 0);
    return {
      items,
      favorites,
      recentlyViewed,
      hydrated,
      cartOpen,
      toasts,
      lastAdded,
      addItem,
      removeItem,
      setQuantity,
      clearCart,
      toggleFavorite,
      isFavorite: (slug: string) => favorites.includes(slug),
      pushRecent,
      clearRecent,
      openCart,
      closeCart,
      pushToast,
      subtotal,
      listSubtotal,
      count: items.reduce((acc, i) => acc + i.quantity, 0),
    };
  }, [
    items,
    favorites,
    recentlyViewed,
    hydrated,
    cartOpen,
    toasts,
    lastAdded,
    addItem,
    removeItem,
    setQuantity,
    clearCart,
    toggleFavorite,
    pushRecent,
    clearRecent,
    openCart,
    closeCart,
    pushToast,
  ]);

  // El estado vigente queda en una ref y se avisa a los suscriptos después de
  // cada commit; `useSyncExternalStore` los redibuja solo si su parte cambió.
  const current = useRef(value);
  const listeners = useRef(new Set<() => void>());
  const [snapshot] = useState<StoreSnapshot>(() => ({
    get: () => current.current,
    subscribe: (listener) => {
      listeners.current.add(listener);
      return () => listeners.current.delete(listener);
    },
  }));
  useLayoutEffect(() => {
    current.current = value;
    for (const listener of listeners.current) listener();
  }, [value]);

  return (
    <StoreContext.Provider value={value}>
      <SnapshotContext.Provider value={snapshot}>{children}</SnapshotContext.Provider>
    </StoreContext.Provider>
  );
}

/**
 * Una parte del store. El selector tiene que devolver algo que no cambie si el
 * dato no cambió: un número, un booleano o una acción (son estables). Por
 * ejemplo `useStoreSelector((s) => s.addItem)` o
 * `useStoreSelector((s) => s.hydrated && s.favorites.includes(slug))`.
 */
export function useStoreSelector<T>(selector: (state: StoreState) => T): T {
  const snapshot = useContext(SnapshotContext);
  if (!snapshot) throw new Error("useStoreSelector debe usarse dentro de StoreProvider");
  const read = () => selector(snapshot.get());
  return useSyncExternalStore(snapshot.subscribe, read, read);
}

export function useStore(): StoreState {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore debe usarse dentro de StoreProvider");
  return context;
}
