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
import ContactPicker from "@/components/contacts/ContactPicker";
import type { CustomerContact } from "@/lib/services/customer-contacts";

type NewLeadFormProps = {
  customers: Customer[];
  jobs: Job[];
  leadSources: LeadSource[];
  contacts: CustomerContact[];
  copySource?: Job | null;
};

export default function NewLeadForm({ customers, jobs, leadSources, contacts, copySource = null }: NewLeadFormProps) {
  const router = useRouter();
  const isCopy = Boolean(copySource);

  const [customerMode, setCustomerMode] =
    useState<CustomerSelectionMode>("existing");
  const [customerId, setCustomerId] = useState(copySource?.customer_id ?? "");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");

  const [projectName, setProjectName] = useState("");
  const [projectCustomerName, setProjectCustomerName] = useState(copySource?.project_customer_name ?? "");
  const [qfNumber, setQfNumber] = useState("");
  const [projectPhone, setProjectPhone] = useState(copySource?.phone ?? "");
  const [projectEmail, setProjectEmail] = useState(copySource?.email ?? "");
  const [projectAddress, setProjectAddress] = useState(copySource?.address ?? "");
  const [leadSource, setLeadSource] = useState(copySource?.lead_source ?? "");
  const [salesperson, setSalesperson] = useState(copySource?.salesperson ?? "");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDue, setNextActionDue] = useState("");
  const [notes, setNotes] = useState(copySource?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [companyContactId, setCompanyContactId] = useState(copySource?.company_contact_id ?? "");
  const [projectContactId, setProjectContactId] = useState(copySource?.project_contact_id ?? "");
  const [jobSiteContactId, setJobSiteContactId] = useState(copySource?.job_site_contact_id ?? "");
  const [hasSeparateSiteContact, setHasSeparateSiteContact] = useState(Boolean(copySource?.job_site_contact_id));
  const [availableContacts, setAvailableContacts] = useState(contacts);
  const [installationRequired, setInstallationRequired] = useState(copySource?.installation_required ?? true);

  function rememberContact(contact: CustomerContact) {
    setAvailableContacts((current) => current.some((item) => item.id === contact.id) ? current.map((item) => item.id === contact.id ? contact : item) : [...current, contact]);
  }

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
    setCompanyContactId("");
    setProjectContactId("");
    setJobSiteContactId("");
    setHasSeparateSiteContact(false);
    setErrorMessage("");
  }

  function handleCustomerSelect(customer: Customer | null) {
    setCustomerId(customer?.id ?? "");
    setCompanyContactId("");
    setProjectContactId("");
    setJobSiteContactId("");
    setHasSeparateSiteContact(false);
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

    if (isCopy && !qfNumber.trim()) {
      setErrorMessage("A new QF# is required when copying a job.");
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
          projectCustomerName,
          qfNumber,
          phone: projectPhone,
          email: projectEmail,
          address: projectAddress,
          leadSource,
          salesperson,
          nextAction,
          nextActionDue,
          notes,
          companyContactId,
          projectContactId,
          jobSiteContactId: hasSeparateSiteContact ? jobSiteContactId : "",
          installationRequired,
        },
        copySourceJobId: copySource?.id ?? null,
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

      {isCopy ? (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
          <p className="text-sm font-semibold text-gray-950">Customer</p>
          <p className="mt-1 text-lg font-semibold text-gray-950">
            {selectedCustomer?.full_name ?? copySource?.customer?.full_name ?? "Existing customer"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            This copied job remains connected to the same customer. Contacts can be adjusted below.
          </p>
        </section>
      ) : (
        <CustomerSelector
          mode={customerMode}
          customers={customers}
          jobs={jobs}
          selectedCustomerId={customerId}
          disabled={isSaving}
          onModeChange={handleCustomerModeChange}
          onCustomerSelect={handleCustomerSelect}
        />
      )}

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

          <Field label="Customer Address" htmlFor="newCustomerAddress">
            <input id="newCustomerAddress" type="text" autoComplete="street-address" disabled={isSaving} value={newCustomerAddress} onChange={(event) => setNewCustomerAddress(event.target.value)} className={inputClass} />
          </Field>
        </FormSection>
      ) : null}

      <FormSection
        title={isCopy ? "Create Copied Job" : "Create New Job"}
        description={isCopy ? "Review the copied details, then enter a unique job name and QF#." : "Enter the details for this new flooring opportunity. These fields belong to the job, not the customer record."}
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

        <Field label="Project Customer Name" htmlFor="projectCustomerName">
          <input id="projectCustomerName" type="text" disabled={isSaving} value={projectCustomerName} onChange={(event) => setProjectCustomerName(event.target.value)} placeholder="Example: Starbucks #140, homeowner, tenant, or end customer" className={inputClass} />
        </Field>

        {isCopy ? (
          <Field label="QF#" htmlFor="qfNumber" required>
            <input
              id="qfNumber"
              type="text"
              required
              disabled={isSaving}
              value={qfNumber}
              onChange={(event) => setQfNumber(event.target.value)}
              placeholder="Enter the new QFloors reference"
              className={inputClass}
            />
          </Field>
        ) : null}

        <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
          <Field label="Project Phone (fallback)" htmlFor="projectPhone">
            <input id="projectPhone" type="tel" disabled={isSaving} value={projectPhone} onChange={(event) => setProjectPhone(event.target.value)} placeholder={selectedCustomer?.phone ?? "Optional; customer phone is used if blank"} className={inputClass} />
          </Field>
          <Field label="Project Email (fallback)" htmlFor="projectEmail">
            <input id="projectEmail" type="email" disabled={isSaving} value={projectEmail} onChange={(event) => setProjectEmail(event.target.value)} placeholder={selectedCustomer?.email ?? "Optional; customer email is used if blank"} className={inputClass} />
          </Field>
        </div>

        <Field label="Project Address" htmlFor="projectAddress">
          <input id="projectAddress" type="text" disabled={isSaving} value={projectAddress} onChange={(event) => setProjectAddress(event.target.value)} placeholder="Unit or property address for this job" className={inputClass} />
        </Field>

        <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={installationRequired}
            onChange={(event) => setInstallationRequired(event.target.checked)}
            disabled={isSaving}
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
          />
          <span>
            <span className="block font-medium text-gray-900">Installation Required</span>
            <span className="mt-0.5 block text-gray-500">
              Turn this off for materials-only jobs or customers using another installer.
            </span>
          </span>
        </label>

        {customerMode === "existing" && selectedCustomer ? (
          <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 sm:grid-cols-2">
            <ContactPicker
              label="Company Contact"
              value={companyContactId}
              contacts={availableContacts}
              customers={customers}
              parentCustomerId={selectedCustomer.id}
              restrictToParent
              disabled={isSaving}
              description="Optional company employee or project manager."
              onChange={(id, created) => {
                if (created) rememberContact(created);
                setCompanyContactId(id);
              }}
            />
            <ContactPicker
              label="Project / Job Contact"
              value={projectContactId}
              contacts={availableContacts}
              customers={customers}
              parentCustomerId={selectedCustomer.id}
              disabled={isSaving}
              description="Homeowner, end user, tenant, manager, designer, or other project stakeholder."
              onChange={(id, created) => {
                if (created) rememberContact(created);
                setProjectContactId(id);
              }}
            />
            {companyContactId ? <div className="sm:col-start-2"><button type="button" onClick={() => setProjectContactId(companyContactId)} className="text-xs font-medium text-blue-700">Same as Company Contact</button></div> : null}
            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <input type="checkbox" checked={hasSeparateSiteContact} onChange={(event) => { setHasSeparateSiteContact(event.target.checked); if (!event.target.checked) setJobSiteContactId(""); }} disabled={isSaving} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                <span><span className="block font-medium text-gray-900">Add a separate Job Site Contact</span><span className="mt-0.5 block text-gray-500">Only needed when field access or coordination is handled by someone different.</span></span>
              </label>
              {hasSeparateSiteContact ? <div className="mt-3"><ContactPicker label="Job Site Contact" value={jobSiteContactId} contacts={availableContacts} customers={customers} parentCustomerId={selectedCustomer.id} disabled={isSaving} description="Superintendent, site manager, access contact, or field coordinator." onChange={(id, created) => { if (created) rememberContact(created); setJobSiteContactId(id); }} /><div className="mt-2 flex flex-wrap gap-2">{companyContactId ? <button type="button" onClick={() => setJobSiteContactId(companyContactId)} className="text-xs font-medium text-blue-700">Same as Company Contact</button> : null}{projectContactId ? <button type="button" onClick={() => setJobSiteContactId(projectContactId)} className="text-xs font-medium text-blue-700">Same as Project Contact</button> : null}</div></div> : null}
            </div>
          </div>
        ) : customerMode === "new" ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500 sm:col-span-2">
            Create the customer and job first, then assign Company, Project / Job, and optional Job Site contacts from Edit Job Info.
          </p>
        ) : null}

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
          {isSaving ? "Creating..." : isCopy ? "Create Copied Job" : "Create New Job Lead"}
        </button>
        <button type="button" disabled={isSaving} onClick={() => router.push(copySource ? `/leads/${copySource.id}` : "/leads")} className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
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
