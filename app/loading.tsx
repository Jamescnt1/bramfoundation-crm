export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-3 w-28 rounded bg-gray-200" />
        <div className="mt-3 h-8 w-64 max-w-[70vw] rounded bg-gray-300" />
        <div className="mt-3 h-4 w-96 max-w-[85vw] rounded bg-gray-200" />
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-4">
            <div className="h-5 w-40 rounded bg-gray-200" />
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="grid grid-cols-[2fr_1fr_1fr] gap-4 rounded-lg border border-gray-100 p-3">
                <div className="h-4 rounded bg-gray-200" />
                <div className="h-4 rounded bg-gray-100" />
                <div className="h-4 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading Foundation CRM…</span>
    </main>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="h-3 w-24 rounded bg-gray-200" />
      <div className="mt-3 h-7 w-16 rounded bg-gray-300" />
      <div className="mt-2 h-3 w-32 rounded bg-gray-100" />
    </div>
  );
}
