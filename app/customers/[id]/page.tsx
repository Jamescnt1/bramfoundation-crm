import Link from "next/link";
import { notFound } from "next/navigation";
import CustomerDetails from "@/components/customers/CustomerDetails";
import type { Customer } from "@/components/customers/types";
import { getCustomerById } from "@/lib/services/customers";
import {
  getJobsByCustomerId,
  type Job,
} from "@/lib/services/jobs";
import { getActiveEmployees } from "@/lib/services/employees";
import { getTasks, getTaskTypes } from "@/lib/services/tasks";
import type { Employee } from "@/lib/services/employees";
import type { TaskType, UniversalTask } from "@/components/tasks/types";

export const dynamic = "force-dynamic";

type CustomerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerPage({
  params,
}: CustomerPageProps) {
  const { id } = await params;
  let customer: Customer | null = null;
  let jobs: Job[] = [];
  let tasks: UniversalTask[] = [];
  let employees: Employee[] = [];
  let taskTypes: TaskType[] = [];
  let errorMessage = "";

  try {
    [customer, jobs, tasks, employees, taskTypes] = await Promise.all([
      getCustomerById(id),
      getJobsByCustomerId(id),
      getTasks({ customerId: id }),
      getActiveEmployees(),
      getTaskTypes(),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "";
  }

  if (errorMessage) {
    if (
      errorMessage.includes("JSON object requested") ||
      errorMessage.includes("0 rows") ||
      errorMessage.includes("PGRST116")
    ) {
      notFound();
    }

    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/customers"
            className="text-sm font-medium text-gray-600 transition hover:text-black"
          >
            ← Back to customers
          </Link>

          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {`Unable to load customer: ${errorMessage}`}
          </div>
        </div>
      </main>
    );
  }

  if (!customer) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/customers"
          className="text-sm font-medium text-gray-600 transition hover:text-black"
        >
          ← Back to customers
        </Link>

        <div className="mt-6">
          <CustomerDetails
            customer={customer}
            jobs={jobs}
            tasks={tasks}
            employees={employees}
            taskTypes={taskTypes}
          />
        </div>
      </div>
    </main>
  );
}
