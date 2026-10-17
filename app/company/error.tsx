"use client";

export default function CompanyDashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-red-700">Company dashboard could not load</p>
        <p className="mt-2 text-sm text-gray-600">
          The rest of Foundation remains available. Retry the dashboard request, or use Pipeline and Reports while the connection recovers.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          Retry dashboard
        </button>
      </div>
    </main>
  );
}
