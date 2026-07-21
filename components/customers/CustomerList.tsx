"use client";

import { useMemo, useState } from "react";
import type { Job } from "@/lib/services/jobs";
import CustomerHierarchyRow from "./CustomerHierarchyRow";
import type { Customer } from "./types";

type CustomerListProps = {
  initialCustomers: Customer[];
  initialJobs: Job[];
};

export default function CustomerList({
  initialCustomers,
  initialJobs,
}: CustomerListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(
    () => new Set(initialCustomers.filter((customer) =>
      initialJobs.some((job) => job.customer_id === customer.id),
    ).map((customer) => customer.id)),
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const customerGroups = useMemo(() => {
    return initialCustomers
      .map((customer) => {
        const jobs = initialJobs.filter(
          (job) => job.customer_id === customer.id,
        );

        const customerMatches = [
          customer.full_name,
          customer.phone,
          customer.email,
          customer.address,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));

        const matchingJobs = jobs.filter((job) =>
          [
            job.customer_name,
            job.qfloors_job_number,
            job.address,
            job.status,
            job.lead_source,
          ].some((value) => value?.toLowerCase().includes(normalizedQuery)),
        );

        if (normalizedQuery && !customerMatches && matchingJobs.length === 0) {
          return null;
        }

        return {
          customer,
          jobs: normalizedQuery && !customerMatches ? matchingJobs : jobs,
        };
      })
      .filter((group): group is NonNullable<typeof group> => group !== null);
  }, [initialCustomers, initialJobs, normalizedQuery]);

  function toggleCustomer(customerId: string) {
    setExpandedCustomerIds((current) => {
      const next = new Set(current);

      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }

      return next;
    });
  }

  return (
    <section className="mt-8">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label htmlFor="customer-search" className="sr-only">
          Search customers and jobs
        </label>
        <input
          id="customer-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search customers, jobs, addresses, statuses, or QF#..."
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          {customerGroups.length} {customerGroups.length === 1 ? "customer" : "customers"}
        </p>
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-sm font-medium text-gray-600 hover:text-black"
          >
            Clear search
          </button>
        ) : null}
      </div>

      {initialCustomers.length === 0 ? (
        <EmptyState
          title="No customers have been added yet"
          description="Add your first customer to begin organizing their jobs, appointments, tasks, and activity."
        />
      ) : customerGroups.length === 0 ? (
        <EmptyState
          title="No matching customers or jobs"
          description="Try a customer name, contact detail, project address, status, or QF#."
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:flex sm:items-center sm:justify-between">
            <span>Customer and jobs</span>
            <span className="pr-1">Job summary</span>
          </div>

          {customerGroups.map(({ customer, jobs }) => (
            <CustomerHierarchyRow
              key={customer.id}
              customer={customer}
              jobs={jobs}
              expanded={normalizedQuery ? true : expandedCustomerIds.has(customer.id)}
              onToggle={() => toggleCustomer(customer.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  );
}
