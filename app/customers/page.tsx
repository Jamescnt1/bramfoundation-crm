import Link from "next/link";
import CustomerList from "@/components/customers/CustomerList";
import type { Customer } from "@/components/customers/types";
import { getCustomers } from "@/lib/services/customers";
import {
  getJobs,
  type Job,
} from "@/lib/services/jobs";
import PageHeader from "@/components/layout/PageHeader";
import { getPipelineStages } from "@/lib/services/pipeline-stages";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  let customers: Customer[] = [];
  let jobs: Job[] = [];
  let stages: Awaited<ReturnType<typeof getPipelineStages>> = [];
  let errorMessage = "";

  try {
    [customers, jobs, stages] = await Promise.all([
      getCustomers(),
      getJobs(),
      getPipelineStages(),
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
        <PageHeader
          title="Customers"
          description="Manage customer contact information and flooring projects."
          actions={<Link
            href="/customers/new"
            className="foundation-primary-action w-fit px-5 py-2.5"
          >
            + New Customer
          </Link>}
        />

        {errorMessage ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            Unable to load customers: {errorMessage}
          </div>
        ) : (
          <CustomerList
            initialCustomers={customers}
            initialJobs={jobs}
            stages={stages}
          />
        )}
      </div>
    </main>
  );
}
