import { Skeleton } from '@/components/ui/primitives';

export function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    </div>
  );
}
