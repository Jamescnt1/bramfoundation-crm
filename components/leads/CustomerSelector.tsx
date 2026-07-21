"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Check, Search, UserPlus, Users } from "lucide-react";
import PipelineStatusBadge from "@/components/pipeline/PipelineStatusBadge";
import { formatJobDisplayName } from "@/lib/job-display";
import type { Customer } from "@/components/customers/types";
import type { Job } from "@/lib/services/jobs";

export type CustomerSelectionMode = "existing" | "new";

type CustomerSelectorProps = {
  mode: CustomerSelectionMode;
  customers: Customer[];
  jobs: Job[];
  selectedCustomerId: string;
  disabled?: boolean;
  onModeChange: (mode: CustomerSelectionMode) => void;
  onCustomerSelect: (customer: Customer | null) => void;
};

const recentCustomerLimit = 5;

export default function CustomerSelector({
  mode,
  customers,
  jobs,
  selectedCustomerId,
  disabled = false,
  onModeChange,
  onCustomerSelect,
}: CustomerSelectorProps) {
  const [query, setQuery] = useState("");

  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ?? null;

  const selectedCustomerJobs = useMemo(
    () =>
      selectedCustomer
        ? jobs.filter((job) => job.customer_id === selectedCustomer.id)
        : [],
    [jobs, selectedCustomer],
  );

  const recentCustomers = useMemo(
    () =>
      [...customers]
        .sort((first, second) => {
          const firstDate = first.created_at
            ? new Date(first.created_at).getTime()
            : 0;
          const secondDate = second.created_at
            ? new Date(second.created_at).getTime()
            : 0;

          return secondDate - firstDate;
        })
        .slice(0, recentCustomerLimit),
    [customers],
  );

  const matchingCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return recentCustomers;
    }

    return customers.filter((customer) =>
      [
        customer.full_name,
        customer.phone,
        customer.email,
        customer.address,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery)),
    );
  }, [customers, query, recentCustomers]);

  function selectCustomer(customer: Customer) {
    onCustomerSelect(customer);
    setQuery("");
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
      <div>
        <p className="text-sm font-semibold text-gray-950">
          Who is this new job for?
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Every lead creates a new job. Choose whether it belongs to a new or
          existing customer.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ModeButton
          active={mode === "new"}
          disabled={disabled}
          icon={<UserPlus />}
          title="New Customer"
          description="Create a customer and their first job"
          onClick={() => onModeChange("new")}
        />
        <ModeButton
          active={mode === "existing"}
          disabled={disabled}
          icon={<Users />}
          title="Existing Customer"
          description="Add a new job to their history"
          onClick={() => onModeChange("existing")}
        />
      </div>

      {mode === "existing" ? (
        <div className="mt-5 border-t border-gray-200 pt-5">
          {selectedCustomer ? (
            <SelectedCustomer
              customer={selectedCustomer}
              jobs={selectedCustomerJobs}
              disabled={disabled}
              onChange={() => onCustomerSelect(null)}
            />
          ) : (
            <>
              <label
                htmlFor="customer-search"
                className="block text-sm font-medium text-gray-700"
              >
                Search customers
              </label>
              <div className="relative mt-2">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  id="customer-search"
                  type="search"
                  value={query}
                  disabled={disabled}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type a name, phone, email, or address..."
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100"
                />
              </div>

              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <p className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {query.trim() ? "Search results" : "Recent customers"}
                </p>

                {matchingCustomers.length ? (
                  <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
                    {matchingCustomers.map((customer) => {
                      const customerJobs = jobs.filter(
                        (job) => job.customer_id === customer.id,
                      );

                      return (
                        <button
                          key={customer.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => selectCustomer(customer)}
                          className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-gray-950">
                              {customer.full_name}
                            </span>
                            <span className="mt-1 block truncate text-xs text-gray-500">
                              {customer.phone ?? customer.email ?? "No contact information"}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-medium text-gray-500">
                            {customerJobs.length} {customerJobs.length === 1 ? "job" : "jobs"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-5 text-center">
                    <p className="text-sm font-medium text-gray-800">
                      No matching customer
                    </p>
                    <button
                      type="button"
                      onClick={() => onModeChange("new")}
                      className="mt-2 text-sm font-medium text-blue-700 hover:underline"
                    >
                      Create a new customer instead
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ModeButton({
  active,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? "border-black bg-white ring-1 ring-black"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <span className="mt-0.5 text-gray-600 [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>
      <span>
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-950">
          {title}
          {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
        </span>
        <span className="mt-1 block text-xs leading-5 text-gray-500">
          {description}
        </span>
      </span>
    </button>
  );
}

function SelectedCustomer({
  customer,
  jobs,
  disabled,
  onChange,
}: {
  customer: Customer;
  jobs: Job[];
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Linked customer
          </p>
          <p className="mt-1 font-semibold text-gray-950">{customer.full_name}</p>
          <p className="mt-1 text-sm text-gray-600">
            {customer.phone ?? "No phone"} · {customer.email ?? "No email"}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onChange}
          className="w-fit text-sm font-medium text-emerald-800 hover:underline disabled:opacity-60"
        >
          Choose another
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="h-4 w-4 text-gray-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-gray-900">
            Existing jobs ({jobs.length})
          </p>
        </div>

        {jobs.length ? (
          <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {formatJobDisplayName({ customerName: customer.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {job.address ?? "No project address"}
                  </p>
                </div>
                <PipelineStatusBadge status={job.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
            This customer has no jobs yet.
          </p>
        )}

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          A separate new job will be created below and linked to this customer.
        </div>
      </div>
    </div>
  );
}
