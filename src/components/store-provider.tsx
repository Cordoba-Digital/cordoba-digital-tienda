"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  slug: string;
  name: string;
  brand: string;
  image: string;
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
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number, options?: { silent?: boolean; open?: boolean }) => void;
  removeItem: (slug: string) => void;
  setQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  toggleFavorite: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
  pushRecent: (slug: string) => void;
  openCart: () => void;
  closeCart: () => void;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  subtotal: number;
  listSubtotal: number;
  count: number;
};

const StoreContext = createContext<StoreState | null>(null);

const CART_KEY = "cd_cart_v1";
const FAV_KEY = "cd_fav_v1";
const RECENT_KEY = "cd_recent_v1";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setItems(readJSON<CartItem[]>(CART_KEY, []));
      setFavorites(readJSON<string[]>(FAV_KEY, []));
      setRecentlyViewed(readJSON<string[]>(RECENT_KEY, []));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(recentlyViewed));
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
      setItems((prev) => {
        const existing = prev.find((i) => i.slug === item.slug);
        if (existing) {
          const nextQty = Math.min(existing.stock, existing.quantity + quantity);
          return prev.map((i) => (i.slug === item.slug ? { ...i, quantity: nextQty } : i));
        }
        return [...prev, { ...item, quantity: Math.min(item.stock || 1, quantity) }];
      });
      if (!options?.silent) {
        pushToast({ title: "Agregado al carrito", description: item.name, tone: "success" });
      }
      if (options?.open !== false) setCartOpen(true);
    },
    [pushToast],
  );

  const removeItem = useCallback((slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.slug === slug ? { ...i, quantity: Math.max(0, Math.min(i.stock, quantity)) } : i))
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const toggleFavorite = useCallback(
    (slug: string) => {
      const exists = favorites.includes(slug);
      setFavorites(exists ? favorites.filter((s) => s !== slug) : [...favorites, slug]);
      pushToast({ title: exists ? "Quitado de favoritos" : "Guardado en favoritos", tone: "info" });
    },
    [favorites, pushToast],
  );

  const pushRecent = useCallback((slug: string) => {
    setRecentlyViewed((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, 8));
  }, []);

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
      addItem,
      removeItem,
      setQuantity,
      clearCart,
      toggleFavorite,
      isFavorite: (slug: string) => favorites.includes(slug),
      pushRecent,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
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
    addItem,
    removeItem,
    setQuantity,
    clearCart,
    toggleFavorite,
    pushRecent,
    pushToast,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore debe usarse dentro de StoreProvider");
  return context;
}
