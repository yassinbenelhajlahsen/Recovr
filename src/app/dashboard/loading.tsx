export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 flex flex-col xl:flex-row gap-8 items-start">

      {/* Left column */}
      <div className="flex-1 min-w-0 space-y-6">

        {/* Header: title + button */}
        <div className="flex items-center justify-between gap-4">
          <div className="skeleton h-11 w-52 rounded-lg" />
          <div className="skeleton h-10 w-10 sm:w-32 rounded-lg shrink-0" />
        </div>

        {/* Filters */}
        <div className="skeleton h-10 w-full rounded-lg" />

        {/* Workout cards — zone blocks, no internal detail */}
        <div className="space-y-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="skeleton h-[72px] w-full rounded-xl" />
          ))}
        </div>

      </div>

      {/* Right column: recovery panel */}
      <div className="w-full xl:w-72 shrink-0 xl:sticky xl:top-24">
        <div className="skeleton h-96 w-full rounded-xl" />
      </div>

    </div>
  );
}
