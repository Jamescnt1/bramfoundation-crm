import Link from "next/link";
import CustomerForm from "@/components/customers/CustomerForm";

export default function NewCustomerPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/customers"
          className="text-sm font-medium text-gray-600 transition hover:text-black"
        >
          ← Back to customers
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold text-gray-900">
            New Customer
          </h1>

          <p className="mt-2 text-gray-600">
            Add a customer to Foundation CRM.
          </p>
        </header>

        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <CustomerForm />
        </section>
      </div>
    </main>
  );
}
