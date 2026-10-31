export default function Loading() {
  return (
    <div className="grid gap-6">
      <div className="h-12 w-72 animate-pulse rounded-2xl bg-surface-2" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}
