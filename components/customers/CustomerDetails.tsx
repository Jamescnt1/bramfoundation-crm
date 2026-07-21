import Link from "next/link";
import CustomerJobCard from "./CustomerJobCard";
import type { Customer } from "./types";
import type { Job } from "@/lib/services/jobs";
import type { Employee } from "@/lib/services/employees";
import type { TaskType, UniversalTask } from "@/components/tasks/types";
import TaskManager from "@/components/tasks/TaskManager";

type CustomerDetailsProps = {
  customer: Customer;
  jobs: Job[];
  tasks: UniversalTask[];
  employees: Employee[];
  taskTypes: TaskType[];
};

export default function CustomerDetails({
  customer,
  jobs,
  tasks,
  employees,
  taskTypes,
}: CustomerDetailsProps) {
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Customer
            </p>

            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              {customer.full_name}
            </h1>
          </div>

          <Link
            href={`/customers/${customer.id}/edit`}
            className="inline-flex w-fit items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-black"
          >
            Edit Customer
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Phone
            </p>

            {customer.phone ? (
              <a
                href={`tel:${customer.phone}`}
                className="mt-1 block font-medium text-gray-900 hover:underline"
              >
                {customer.phone}
              </a>
            ) : (
              <p className="mt-1 text-gray-500">
                Not provided
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">
              Email
            </p>

            {customer.email ? (
              <a
                href={`mailto:${customer.email}`}
                className="mt-1 block break-all font-medium text-gray-900 hover:underline"
              >
                {customer.email}
              </a>
            ) : (
              <p className="mt-1 text-gray-500">
                Not provided
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">
              Customer Address
            </p>

            <p className="mt-1 whitespace-pre-line text-gray-900">
              {customer.address ?? "Not provided"}
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <p className="text-sm font-medium text-gray-500">
            Notes
          </p>

          <p className="mt-2 whitespace-pre-wrap text-gray-700">
            {customer.notes ?? "No customer notes have been added."}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Jobs
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {jobs.length}{" "}
              {jobs.length === 1 ? "flooring project" : "flooring projects"}{" "}
              associated with this customer.
            </p>
          </div>

          <Link
            href="/leads/new"
            className="inline-flex w-fit items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            + New Job
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <h3 className="font-medium text-gray-900">
              No linked jobs yet
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">
              Create a job and select this customer to begin tracking
              their project, appointments, tasks, and activity.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {jobs.map((job) => (
              <CustomerJobCard
                key={job.id}
                job={job}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <TaskManager compact initialTasks={tasks} customers={[customer]} jobs={jobs} employees={employees} taskTypes={taskTypes} fixedCustomerId={customer.id} />
      </section>
    </div>
  );
}
