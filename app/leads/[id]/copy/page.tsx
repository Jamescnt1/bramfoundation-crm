import Link from "next/link";
import { notFound } from "next/navigation";
import NewLeadForm from "@/components/NewLeadForm";
import { getCustomerContacts } from "@/lib/services/customer-contacts";
import { getCustomers } from "@/lib/services/customers";
import { getJobById, getJobs } from "@/lib/services/jobs";
import { getLeadSources } from "@/lib/services/lead-sources";

export const dynamic = "force-dynamic";

type CopyJobPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CopyJobPage({ params }: CopyJobPageProps) {
  const { id } = await params;

  const [sourceResult, customersResult, jobsResult, leadSourcesResult, contactsResult] =
    await Promise.allSettled([
      getJobById(id),
      getCustomers(),
      getJobs(),
      getLeadSources(),
      getCustomerContacts(),
    ]);

  if (sourceResult.status === "rejected") {
    return <CopyJobError jobId={id} message={message(sourceResult.reason)} />;
  }

  const sourceJob = sourceResult.value;
  if (!sourceJob?.customer_id) notFound();

  if (customersResult.status === "rejected") {
    return <CopyJobError jobId={id} message={message(customersResult.reason)} />;
  }
  if (jobsResult.status === "rejected") {
    return <CopyJobError jobId={id} message={message(jobsResult.reason)} />;
  }
  if (leadSourcesResult.status === "rejected") {
    return <CopyJobError jobId={id} message={message(leadSourcesResult.reason)} />;
  }
  if (contactsResult.status === "rejected") {
    return <CopyJobError jobId={id} message={message(contactsResult.reason)} />;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <Link href={`/leads/${id}`} className="text-sm font-medium text-gray-600 hover:text-black">
          ← Back to job workspace
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold">Copy Job</h1>
          <p className="mt-2 text-gray-600">
            Create another job for the same customer using this job’s contact and project details.
          </p>
        </header>

        <div className="mt-8">
          <NewLeadForm
            customers={customersResult.value}
            jobs={jobsResult.value}
            leadSources={leadSourcesResult.value}
            contacts={contactsResult.value}
            copySource={sourceJob}
          />
        </div>
      </div>
    </main>
  );
}

function CopyJobError({ jobId, message: errorMessage }: { jobId: string; message: string }) {
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <Link href={`/leads/${jobId}`} className="text-sm font-medium text-gray-600 hover:text-black">
          ← Back to job workspace
        </Link>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          Unable to prepare the copied job: {errorMessage}
        </div>
      </div>
    </main>
  );
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
