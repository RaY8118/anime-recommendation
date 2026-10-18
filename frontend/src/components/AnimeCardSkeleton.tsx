export const AnimeCardSkeleton = () => (
  <div className="rounded-2xl glass p-5">
    <div className="skeleton mb-4 h-72 w-full rounded-lg" />
    <div className="skeleton mb-2.5 h-4 w-3/4 rounded-full" />
    <div className="skeleton mb-2 h-3 w-full rounded-full" />
    <div className="skeleton h-3 w-5/6 rounded-full" />
  </div>
);

export const CardGridSkeleton = ({
  count = 8,
  className = "grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
}: {
  count?: number;
  className?: string;
}) => (
  <div className={className}>
    {Array.from({ length: count }).map((_, i) => (
      <AnimeCardSkeleton key={i} />
    ))}
  </div>
);
