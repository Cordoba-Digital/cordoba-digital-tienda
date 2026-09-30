export default function LoadingCatalog() {
  return (
    <div className="container-xl py-8">
      <div className="mb-3 h-3 w-28 animate-pulse rounded bg-ink-100" />
      <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-ink-100" />
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="hidden h-[32rem] animate-pulse rounded-2xl bg-ink-100 lg:block" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-ink-100 bg-surface">
              <div className="aspect-square animate-pulse bg-ink-100" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-16 animate-pulse rounded bg-ink-100" />
                <div className="h-4 w-full animate-pulse rounded bg-ink-100" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100" />
                <div className="mt-3 h-6 w-24 animate-pulse rounded bg-ink-100" />
                <div className="mt-3 h-10 w-full animate-pulse rounded-xl bg-ink-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
