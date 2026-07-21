"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerSelector, {
  type CustomerSelectionMode,
} from "@/components/leads/CustomerSelector";
import type { Customer } from "@/components/customers/types";
import SalespersonSelect from "@/components/SalespersonSelect";
import { createLeadAction } from "@/app/leads/new/actions";
import type { Job } from "@/lib/services/jobs";
import type { LeadSource } from "@/lib/services/lead-sources";

type NewLeadFormProps = {
  customers: Customer[];
  jobs: Job[];
  leadSources: LeadSource[];
};

export default function NewLeadForm({ customers, jobs, leadSources }: NewLeadFormProps) {
  const router = useRouter();

  const [customerMode, setCustomerMode] =
    useState<CustomerSelectionMode>("existing");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");

  const [projectName, setProjectName] = useState("");
  const [projectPhone, setProjectPhone] = useState("");
  const [projectEmail, setProjectEmail] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDue, setNextActionDue] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCustomer =
    customers.find((customer) => customer.id === customerId) ?? null;

  const possibleDuplicates = useMemo(() => {
    const normalizedName = newCustomerName.trim().toLowerCase();

    if (customerMode !== "new" || normalizedName.length < 3) {
      return [];
    }

    return customers
      .filter((customer) =>
        customer.full_name.toLowerCase().includes(normalizedName),
      )
      .slice(0, 3);
  }, [customerMode, customers, newCustomerName]);

  function handleCustomerModeChange(mode: CustomerSelectionMode) {
    setCustomerMode(mode);
    setCustomerId("");
    setErrorMessage("");
  }

  function handleCustomerSelect(customer: Customer | null) {
    setCustomerId(customer?.id ?? "");
    setErrorMessage("");
  }

  function selectExistingCustomer(customer: Customer) {
    setCustomerMode("existing");
    setCustomerId(customer.id);
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedProjectName = projectName.trim();
    const trimmedCustomerName = newCustomerName.trim();

    if (customerMode === "existing" && !selectedCustomer) {
      setErrorMessage("Please select the existing customer for this job.");
      return;
    }

    if (customerMode === "new" && !trimmedCustomerName) {
      setErrorMessage("Customer name is required.");
      return;
    }

    if (!trimmedProjectName) {
      setErrorMessage("Project / lead name is required.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const job = await createLeadAction({
        customerMode,
        customerId,
        newCustomer: {
          name: trimmedCustomerName,
          phone: newCustomerPhone,
          email: newCustomerEmail,
          address: newCustomerAddress,
        },
        job: {
          name: trimmedProjectName,
          phone: projectPhone,
          email: projectEmail,
          address: projectAddress,
          leadSource,
          salesperson,
          nextAction,
          nextActionDue,
          notes,
        },
      });

      router.push(`/leads/${job.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Unable to create lead: {errorMessage}
        </div>
      ) : null}

      <CustomerSelector
        mode={customerMode}
        customers={customers}
        jobs={jobs}
        selectedCustomerId={customerId}
        disabled={isSaving}
        onModeChange={handleCustomerModeChange}
        onCustomerSelect={handleCustomerSelect}
      />

      {customerMode === "new" ? (
        <FormSection
          title="New customer information"
          description="This information is saved on the customer record and can be reused for future jobs."
        >
          <Field label="Customer Name" htmlFor="newCustomerName" required>
            <input
              id="newCustomerName"
              type="text"
              autoComplete="name"
              required
              disabled={isSaving}
              value={newCustomerName}
              onChange={(event) => setNewCustomerName(event.target.value)}
              className={inputClass}
            />
          </Field>

          {possibleDuplicates.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 sm:col-span-2">
              <p className="text-sm font-semibold text-amber-900">
                Is this customer already in the CRM?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {possibleDuplicates.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectExistingCustomer(customer)}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Use {customer.full_name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
            <Field label="Customer Phone" htmlFor="newCustomerPhone">
              <input id="newCustomerPhone" type="tel" autoComplete="tel" disabled={isSaving} value={newCustomerPhone} onChange={(event) => setNewCustomerPhone(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Customer Email" htmlFor="newCustomerEmail">
              <input id="newCustomerEmail" type="email" autoComplete="email" disabled={isSaving} value={newCustomerEmail} onChange={(event) => setNewCustomerEmail(event.target.value)} className={inputClass} />
            </Field>
          </div>

          <Field label="Customer Contact Address" htmlFor="newCustomerAddress">
            <input id="newCustomerAddress" type="text" autoComplete="street-address" disabled={isSaving} value={newCustomerAddress} onChange={(event) => setNewCustomerAddress(event.target.value)} className={inputClass} />
          </Field>
        </FormSection>
      ) : null}

      <FormSection
        title="Create New Job"
        description="Enter the details for this new flooring opportunity. These fields belong to the job, not the customer record."
      >
        <Field label="Project / Lead Name" htmlFor="projectName" required>
          <input
            id="projectName"
            type="text"
            required
            disabled={isSaving}
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Example: Unit 217, Kitchen LVP, or Main Office"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
          <Field label="Project Contact Phone" htmlFor="projectPhone">
            <input id="projectPhone" type="tel" disabled={isSaving} value={projectPhone} onChange={(event) => setProjectPhone(event.target.value)} placeholder={selectedCustomer?.phone ?? "Optional; customer phone is used if blank"} className={inputClass} />
          </Field>
          <Field label="Project Contact Email" htmlFor="projectEmail">
            <input id="projectEmail" type="email" disabled={isSaving} value={projectEmail} onChange={(event) => setProjectEmail(event.target.value)} placeholder={selectedCustomer?.email ?? "Optional; customer email is used if blank"} className={inputClass} />
          </Field>
        </div>

        <Field label="Project Address" htmlFor="projectAddress">
          <input id="projectAddress" type="text" disabled={isSaving} value={projectAddress} onChange={(event) => setProjectAddress(event.target.value)} placeholder="Unit or property address for this job" className={inputClass} />
        </Field>

        <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
          <Field label="Lead Source" htmlFor="leadSource">
            <select id="leadSource" disabled={isSaving} value={leadSource} onChange={(event) => setLeadSource(event.target.value)} className={inputClass}>
              <option value="">Select a source</option>
              {leadSources.map((source) => <option key={source.id} value={source.name}>{source.name}</option>)}
            </select>
          </Field>
          <Field label="Salesperson" htmlFor="salesperson">
            <SalespersonSelect value={salesperson} onChange={setSalesperson} />
          </Field>
        </div>

        <Field label="Next Action" htmlFor="nextAction">
          <input id="nextAction" type="text" disabled={isSaving} value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Example: Call customer tomorrow" className={inputClass} />
        </Field>
        <Field label="Next Action Due" htmlFor="nextActionDue">
          <input id="nextActionDue" type="date" disabled={isSaving} value={nextActionDue} onChange={(event) => setNextActionDue(event.target.value)} className={inputClass} />
        </Field>

        <Field label="Project / Lead Notes" htmlFor="notes">
          <textarea id="notes" rows={6} disabled={isSaving} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} resize-y`} />
        </Field>
      </FormSection>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row">
        <button type="submit" disabled={isSaving} className="rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60">
          {isSaving ? "Creating..." : "Create New Job Lead"}
        </button>
        <button type="button" disabled={isSaving} onClick={() => router.push("/leads")} className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100";

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, required = false, children }: { label: string; htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="sm:col-span-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
        {label}{required ? <span className="ml-1 text-red-600">*</span> : null}
      </label>
      {children}
    </div>
  );
}
