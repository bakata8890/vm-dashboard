export function AuthSkeleton() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-surface-raised p-8">
        <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}
