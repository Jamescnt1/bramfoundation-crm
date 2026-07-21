import Link from "next/link";

export default function CustomerNotFound() {
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Customer not found
          </h1>

          <p className="mt-2 text-gray-600">
            This customer may have been removed, or the link may
            be incorrect.
          </p>

          <Link
            href="/customers"
            className="mt-6 inline-flex rounded-lg bg-black px-5 py-2.5 font-medium text-white transition hover:bg-gray-800"
          >
            Return to Customers
          </Link>
        </div>
      </div>
    </main>
  );
}