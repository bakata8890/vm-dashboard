export function VMCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5 space-y-3">
      <div className="h-5 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex gap-2">
          <div className="h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}
