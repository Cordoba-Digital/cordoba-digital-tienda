export default function LoadingCatalog() {
  return (
    <div className="container-xl py-8">
      <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-surface" />
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="hidden h-[32rem] animate-pulse rounded-2xl bg-surface lg:block" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-[24rem] animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
