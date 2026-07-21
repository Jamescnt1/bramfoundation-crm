import Link from "next/link";
import CustomerList from "@/components/customers/CustomerList";
import type { Customer } from "@/components/customers/types";
import { getCustomers } from "@/lib/services/customers";
import {
  getJobs,
  type Job,
} from "@/lib/services/jobs";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  let customers: Customer[] = [];
  let jobs: Job[] = [];
  let errorMessage = "";

  try {
    [customers, jobs] = await Promise.all([
      getCustomers(),
      getJobs(),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Customers
            </h1>

            <p className="mt-2 text-gray-600">
              Manage customer contact information and
              flooring projects.
            </p>
          </div>

          <Link
            href="/customers/new"
            className="inline-flex w-fit items-center justify-center rounded-lg bg-black px-5 py-2.5 font-medium text-white transition hover:bg-gray-800"
          >
            + New Customer
          </Link>
        </header>

        {errorMessage ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            Unable to load customers: {errorMessage}
          </div>
        ) : (
          <CustomerList
            initialCustomers={customers}
            initialJobs={jobs}
          />
        )}
      </div>
    </main>
  );
}
