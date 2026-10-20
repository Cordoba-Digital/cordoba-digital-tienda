/**
 * Lo que se ve en el carrito y el checkout hasta leer el carrito guardado en el
 * navegador. Antes se mostraba la página armada con "0 productos" y "$0", y un
 * instante después saltaba a los ítems reales (o al "no hay productos").
 */
export function CartSkeleton({ title }: { title: string }) {
  return (
    <div className="container-xl pb-28 pt-6 lg:pb-12 lg:pt-8" aria-busy="true">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">{title}</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-surface" />
      </div>
      <span className="sr-only">Cargando tu carrito…</span>
    </div>
  );
}
