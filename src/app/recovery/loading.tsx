export default function RecoveryLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">

      {/* Page header */}
      <div className="mb-8 space-y-3">
        <div className="skeleton h-12 w-44 rounded-lg" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>

      <div className="flex flex-col gap-6">

        {/* Stat pills — single bar */}
        <div className="skeleton h-8 w-72 rounded-full" />

        {/* Body maps + detail panel — two zone blocks */}
        <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 420 }}>
          <div className="skeleton flex-1 rounded-xl" />
          <div className="skeleton lg:w-72 xl:w-80 rounded-xl" style={{ minHeight: 200 }} />
        </div>

      </div>
    </div>
  );
}
