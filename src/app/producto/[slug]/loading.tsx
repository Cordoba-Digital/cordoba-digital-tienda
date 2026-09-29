export default function LoadingProduct() {
  return (
    <div className="container-xl py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-surface" />
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-surface" />
          <div className="h-32 animate-pulse rounded-2xl bg-surface" />
        </div>
        <div className="h-[28rem] animate-pulse rounded-2xl bg-surface" />
      </div>
    </div>
  );
}
