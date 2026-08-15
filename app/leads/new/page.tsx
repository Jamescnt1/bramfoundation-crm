import Link from "next/link";
import NewLeadForm from "@/components/NewLeadForm";
import { getCustomers } from "@/lib/services/customers";
import { getJobs } from "@/lib/services/jobs";
import { getLeadSources } from "@/lib/services/lead-sources";
import { getCustomerContacts } from "@/lib/services/customer-contacts";
import { requireEmployee } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const currentEmployee = await requireEmployee();
  const [customersResult, jobsResult, leadSourcesResult, contactsResult] = await Promise.allSettled([
    getCustomers(),
    getJobs(),
    getLeadSources(),
    getCustomerContacts(),
  ]);

  const customers =
    customersResult.status === "fulfilled" ? customersResult.value : [];
  const jobs = jobsResult.status === "fulfilled" ? jobsResult.value : [];
  const leadSources =
    leadSourcesResult.status === "fulfilled" ? leadSourcesResult.value : [];
  const contacts = contactsResult.status === "fulfilled" ? contactsResult.value : [];
  const loadError =
    customersResult.status === "rejected"
      ? getErrorMessage(customersResult.reason)
      : jobsResult.status === "rejected"
        ? getErrorMessage(jobsResult.reason)
        : leadSourcesResult.status === "rejected"
          ? getErrorMessage(leadSourcesResult.reason)
        : "";

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/leads"
          className="text-sm font-medium text-gray-600 hover:text-black"
        >
          ← Back to leads
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold">New Lead / Job</h1>
          <p className="mt-2 text-gray-600">
            Create a new customer or add a new flooring project to an existing
            customer.
          </p>
        </header>

        {loadError ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            Unable to prepare the lead form: {loadError}
          </div>
        ) : (
          <div className="mt-8">
            <NewLeadForm
              customers={customers}
              jobs={jobs}
            leadSources={leadSources}
              contacts={contacts}
              currentEmployeeName={currentEmployee.name}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}
