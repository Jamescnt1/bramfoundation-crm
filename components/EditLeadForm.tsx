"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SalespersonSelect from "@/components/SalespersonSelect";
import { isConfiguredContractAmountRequired, isConfiguredQfNumberRequired, resolveConfiguredStage, type PipelineStageView } from "@/components/pipeline/constants";
import {
  type Job,
  type UpdateJobValues,
} from "@/lib/services/jobs";
import { deleteLeadAction } from "@/app/leads/[id]/edit/actions";
import RecordDeleteDialog from "@/components/ui/RecordDeleteDialog";
import { formatJobDisplayName } from "@/lib/job-display";
import type { Employee } from "@/lib/services/employees";
import type { Customer } from "@/components/customers/types";
import ContactPicker from "@/components/contacts/ContactPicker";
import type { CustomerContact } from "@/lib/services/customer-contacts";

type EditLeadFormProps = {
  job: Job;
  canDelete?: boolean;
  stages: PipelineStageView[];
  employees?: Employee[];
  contacts?: CustomerContact[];
  customers?: Customer[];
};

export default function EditLeadForm({
  job,
  canDelete = false,
  stages,
  employees = [],
  contacts = [],
  customers = [],
}: EditLeadFormProps) {
  const router = useRouter();

  const [status, setStatus] = useState(
    job.status ?? "New Lead",
  );

  const [salesperson, setSalesperson] = useState(
    job.salesperson ?? "",
  );

  const [nextAction, setNextAction] = useState(
    job.next_action ?? "",
  );

  const [nextActionDue, setNextActionDue] = useState(
    job.next_action_due ?? "",
  );

  const [notes, setNotes] = useState(
    job.notes ?? "",
  );

  const [qfNumber, setQfNumber] = useState(
    job.qfloors_job_number ?? "",
  );
  const [contractAmount, setContractAmount] = useState(
    job.contract_amount == null ? "" : String(job.contract_amount),
  );
  const [isBilled, setIsBilled] = useState(Boolean(job.billed_at));
  const [installationRequired, setInstallationRequired] = useState(job.installation_required);
  const [jobName, setJobName] = useState(job.customer_name);
  const [projectCustomerName, setProjectCustomerName] = useState(job.project_customer_name ?? "");
  const [projectPhone, setProjectPhone] = useState(job.phone ?? "");
  const [projectEmail, setProjectEmail] = useState(job.email ?? "");
  const [address, setAddress] = useState(job.address ?? "");
  const [lockBoxCode, setLockBoxCode] = useState(job.lock_box_code ?? "");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(job.assigned_employee_id ?? "");
  const [companyContactId, setCompanyContactId] = useState(job.company_contact_id ?? "");
  const [projectContactName, setProjectContactName] = useState(job.project_contact_name ?? (job.project_contact ? `${job.project_contact.first_name} ${job.project_contact.last_name}`.trim() : ""));
  const [projectContactPhone, setProjectContactPhone] = useState(job.project_contact_phone ?? job.project_contact?.mobile_phone ?? job.project_contact?.office_phone ?? "");
  const [projectContactDescription, setProjectContactDescription] = useState(job.project_contact_description ?? job.project_contact?.job_title ?? "");
  const [jobSiteContactId, setJobSiteContactId] = useState(job.job_site_contact_id ?? "");
  const [hasSeparateSiteContact, setHasSeparateSiteContact] = useState(Boolean(job.job_site_contact_id));
  const [availableContacts, setAvailableContacts] = useState(contacts);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  function rememberContact(contact: CustomerContact) {
    setAvailableContacts((current) => current.some((item) => item.id === contact.id) ? current.map((item) => item.id === contact.id ? contact : item) : [...current, contact]);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsSaving(true);
    setErrorMessage("");

    if (isConfiguredQfNumberRequired(status, stages) && !qfNumber.trim()) {
      setErrorMessage("QF# is required for Estimate Sent and later stages.");
      setIsSaving(false);
      return;
    }
    const parsedContractAmount = Number(contractAmount.replace(/[$,\s]/g, ""));
    if (
      isConfiguredContractAmountRequired(status, stages) &&
      (!Number.isFinite(parsedContractAmount) || parsedContractAmount <= 0)
    ) {
      setErrorMessage("A positive Contract Amount is required for Approved and later stages.");
      setIsSaving(false);
      return;
    }
    if (isBilled && (!Number.isFinite(parsedContractAmount) || parsedContractAmount <= 0)) {
      setErrorMessage("Contract Amount is required before a job can be marked billed.");
      setIsSaving(false);
      return;
    }

    try {
      const updates: UpdateJobValues = {};
      const nextJobName = jobName.trim();
      const nextProjectCustomerName = projectCustomerName.trim() || null;
      const nextProjectPhone = projectPhone.trim() || null;
      const nextProjectEmail = projectEmail.trim() || null;
      const nextAddress = address.trim() || null;
      const nextLockBoxCode = lockBoxCode.trim() || null;
      const nextAssignedEmployeeId = assignedEmployeeId || null;
      const nextCompanyContactId = companyContactId || null;
      const nextProjectContactName = projectContactName.trim() || null;
      const nextProjectContactPhone = projectContactPhone.trim() || null;
      const nextProjectContactDescription = projectContactDescription.trim() || null;
      const nextJobSiteContactId = hasSeparateSiteContact ? jobSiteContactId || null : null;
      const nextSalesperson = salesperson || null;
      const nextActionValue = nextAction.trim() || null;
      const nextActionDueValue = nextActionDue || null;
      const nextNotes = notes.trim() || null;
      const nextQfNumber = qfNumber.trim() || null;
      const nextContractAmount = contractAmount.trim() || null;
      const nextBilledAt = isBilled
        ? job.billed_at ?? new Date().toISOString()
        : null;

      if (nextJobName !== job.customer_name) updates.customer_name = nextJobName;
      if (nextProjectCustomerName !== job.project_customer_name) updates.project_customer_name = nextProjectCustomerName;
      if (nextProjectPhone !== job.phone) updates.phone = nextProjectPhone;
      if (nextProjectEmail !== job.email) updates.email = nextProjectEmail;
      if (nextAddress !== job.address) updates.address = nextAddress;
      if (nextLockBoxCode !== job.lock_box_code) updates.lock_box_code = nextLockBoxCode;
      if (nextAssignedEmployeeId !== job.assigned_employee_id) {
        updates.assigned_employee_id = nextAssignedEmployeeId;
      }
      if (nextCompanyContactId !== job.company_contact_id) {
        updates.company_contact_id = nextCompanyContactId;
      }
      if (nextProjectContactName !== job.project_contact_name) updates.project_contact_name = nextProjectContactName;
      if (nextProjectContactPhone !== job.project_contact_phone) updates.project_contact_phone = nextProjectContactPhone;
      if (nextProjectContactDescription !== job.project_contact_description) updates.project_contact_description = nextProjectContactDescription;
      if (job.project_contact_id) updates.project_contact_id = null;
      if (nextJobSiteContactId !== job.job_site_contact_id) {
        updates.job_site_contact_id = nextJobSiteContactId;
      }
      if (status !== job.status) updates.status = status;
      if (nextSalesperson !== job.salesperson) updates.salesperson = nextSalesperson;
      if (nextActionValue !== job.next_action) updates.next_action = nextActionValue;
      if (nextActionDueValue !== job.next_action_due) {
        updates.next_action_due = nextActionDueValue;
      }
      if (nextNotes !== job.notes) updates.notes = nextNotes;
      if (nextQfNumber !== job.qfloors_job_number) {
        updates.qfloors_job_number = nextQfNumber;
      }
      const currentContractAmount =
        job.contract_amount == null ? null : String(job.contract_amount);
      if (nextContractAmount !== currentContractAmount) {
        updates.contract_amount = nextContractAmount;
      }
      if (nextBilledAt !== job.billed_at) updates.billed_at = nextBilledAt;
      if (installationRequired !== job.installation_required) {
        updates.installation_required = installationRequired;
      }

      if (Object.keys(updates).length === 0) {
        setIsSaving(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20_000);
      let response: Response;

      try {
        response = await fetch(`/api/jobs/${job.id}/info`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save the job.");
      }

      router.push(`/leads/${job.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "The save request timed out. Please check your connection and try again."
          : error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );

      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Unable to save changes: {errorMessage}
        </div>
      )}

      {isConfiguredQfNumberRequired(status, stages) || qfNumber ? (
      <div>
        <label
          htmlFor="qfNumber"
          className="block text-sm font-medium text-gray-700"
        >
          QF# {isConfiguredQfNumberRequired(status, stages) ? <span className="text-red-600">*</span> : null}
        </label>

        <input
          id="qfNumber"
          name="qfNumber"
          type="text"
          disabled={isSaving}
          value={qfNumber}
          onChange={(event) => setQfNumber(event.target.value)}
          placeholder="Enter QFloors reference"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
        <p className="mt-2 text-sm text-gray-500">
          Required when this job reaches Estimate Sent.
        </p>
      </div>
      ) : null}

      <div>
        <label htmlFor="jobName" className="block text-sm font-medium text-gray-700">Job Name</label>
        <input id="jobName" required disabled={isSaving} value={jobName} onChange={(event) => setJobName(event.target.value)}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
      </div>

      <div>
        <label htmlFor="projectCustomerName" className="block text-sm font-medium text-gray-700">Project Customer Name</label>
        <input id="projectCustomerName" disabled={isSaving} value={projectCustomerName} onChange={(event) => setProjectCustomerName(event.target.value)} placeholder="Example: Starbucks #140, homeowner, tenant, or end customer" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="projectPhone" className="block text-sm font-medium text-gray-700">Project Phone (fallback)</label><input id="projectPhone" type="tel" disabled={isSaving} value={projectPhone} onChange={(event) => setProjectPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></div>
        <div><label htmlFor="projectEmail" className="block text-sm font-medium text-gray-700">Project Email (fallback)</label><input id="projectEmail" type="email" disabled={isSaving} value={projectEmail} onChange={(event) => setProjectEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></div>
      </div>

      <div>
        <label htmlFor="jobAddress" className="block text-sm font-medium text-gray-700">Job Address / Details</label>
        <textarea id="jobAddress" rows={3} disabled={isSaving} value={address} onChange={(event) => setAddress(event.target.value)}
          className="mt-2 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
      </div>

      <div>
        <label htmlFor="lockBoxCode" className="block text-sm font-medium text-gray-700">Lock Box / Access Code</label>
        <input id="lockBoxCode" disabled={isSaving} value={lockBoxCode} onChange={(event) => setLockBoxCode(event.target.value)} placeholder="Optional" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
      </div>

      <fieldset className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-gray-900">Project / Job Contact</legend>
        <p className="text-xs text-gray-500 sm:col-span-2">Any additional person connected to this job—for example a homeowner, manager, designer, daughter, or neighbor.</p>
        <div><label htmlFor="projectContactName" className="block text-sm font-medium text-gray-700">Name</label><input id="projectContactName" disabled={isSaving} value={projectContactName} onChange={(event) => setProjectContactName(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></div>
        <div><label htmlFor="projectContactPhone" className="block text-sm font-medium text-gray-700">Phone</label><input id="projectContactPhone" type="tel" disabled={isSaving} value={projectContactPhone} onChange={(event) => setProjectContactPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></div>
        <div className="sm:col-span-2"><label htmlFor="projectContactDescription" className="block text-sm font-medium text-gray-700">Description / Role</label><input id="projectContactDescription" disabled={isSaving} value={projectContactDescription} onChange={(event) => setProjectContactDescription(event.target.value)} placeholder="Designer, homeowner, daughter, neighbor…" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></div>
      </fieldset>

      <div>
        <label htmlFor="assignedEmployee" className="block text-sm font-medium text-gray-700">Assigned Employee</label>
        <select id="assignedEmployee" disabled={isSaving} value={assignedEmployeeId} onChange={(event) => setAssignedEmployeeId(event.target.value)}
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:bg-gray-100">
          <option value="">Unassigned</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
      </div>

      {job.customer_id ? (
        <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
          <ContactPicker
            label="Company Contact"
            value={companyContactId}
            contacts={availableContacts}
            customers={customers}
            parentCustomerId={job.customer_id}
            restrictToParent
            disabled={isSaving}
            description="Project manager or employee at the parent customer."
            onChange={(id, created) => {
              if (created) rememberContact(created);
              setCompanyContactId(id);
            }}
          />
          <div className="sm:col-span-2">
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm"><input type="checkbox" checked={hasSeparateSiteContact} onChange={(event) => { setHasSeparateSiteContact(event.target.checked); if (!event.target.checked) setJobSiteContactId(""); }} disabled={isSaving} className="mt-0.5 h-4 w-4 rounded border-gray-300"/><span><span className="block font-medium text-gray-900">Add a separate Job Site Contact</span><span className="mt-0.5 block text-gray-500">Only needed when field access or coordination is handled by someone different.</span></span></label>
            {hasSeparateSiteContact ? <div className="mt-3"><ContactPicker label="Job Site Contact" value={jobSiteContactId} contacts={availableContacts} customers={customers} parentCustomerId={job.customer_id} disabled={isSaving} description="Superintendent, site manager, access contact, or field coordinator." onChange={(id, created) => { if (created) rememberContact(created); setJobSiteContactId(id); }} /><div className="mt-2 flex flex-wrap gap-3">{companyContactId ? <button type="button" onClick={() => setJobSiteContactId(companyContactId)} className="text-xs font-medium text-blue-700">Same as Company Contact</button> : null}</div></div> : null}
          </div>
        </div>
      ) : null}

      {isConfiguredContractAmountRequired(status, stages) || contractAmount ? (
        <div>
          <label htmlFor="contractAmount" className="block text-sm font-medium text-gray-700">
            Contract Amount {isConfiguredContractAmountRequired(status, stages) ? <span className="text-red-600">*</span> : null}
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500">$</span>
            <input id="contractAmount" type="number" min="0.01" step="0.01" inputMode="decimal" disabled={isSaving} value={contractAmount} onChange={(event) => setContractAmount(event.target.value)} className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 disabled:bg-gray-100" />
          </div>
          <p className="mt-2 text-sm text-gray-500">Pipeline reporting value only; estimating and accounting remain in QFloors.</p>
        </div>
      ) : null}

      <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm font-medium text-gray-700">
        <input type="checkbox" checked={isBilled} onChange={(event) => setIsBilled(event.target.checked)} disabled={isSaving} className="h-4 w-4 rounded border-gray-300" />
        Mark this job as billed
      </label>

      <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
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

      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium text-gray-700"
        >
          Status
        </label>

        <select
          id="status"
          name="status"
          disabled={isSaving}
          value={resolveConfiguredStage(status, stages)?.slug ?? status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          {stages.map((statusOption) => (
            <option key={statusOption.slug} value={statusOption.slug}>
              {statusOption.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Salesperson
        </label>

        <SalespersonSelect
          value={salesperson}
          onChange={setSalesperson}
        />
      </div>

      <div>
        <label
          htmlFor="nextAction"
          className="block text-sm font-medium text-gray-700"
        >
          Next Action
        </label>

        <input
          id="nextAction"
          name="nextAction"
          type="text"
          disabled={isSaving}
          value={nextAction}
          onChange={(event) =>
            setNextAction(event.target.value)
          }
          placeholder="Example: Call customer with flooring options"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      <div>
        <label
          htmlFor="nextActionDue"
          className="block text-sm font-medium text-gray-700"
        >
          Next Action Due
        </label>

        <input
          id="nextActionDue"
          name="nextActionDue"
          type="date"
          disabled={isSaving}
          value={nextActionDue}
          onChange={(event) =>
            setNextActionDue(event.target.value)
          }
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700"
        >
          Notes
        </label>

        <textarea
          id="notes"
          name="notes"
          rows={7}
          disabled={isSaving}
          value={notes}
          onChange={(event) =>
            setNotes(event.target.value)
          }
          placeholder="Add customer, project, or follow-up notes"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={isSaving} className="rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" disabled={isSaving} onClick={() => router.push(`/leads/${job.id}`)} className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            Cancel
          </button>
        </div>
        {canDelete ? (
          <button type="button" disabled={isSaving} onClick={() => setDeleteDialogOpen(true)} className="rounded-lg border border-red-200 px-5 py-2.5 font-medium text-red-700 transition hover:bg-red-50">
            Delete Lead / Job
          </button>
        ) : null}
      </div>

      <RecordDeleteDialog
        open={deleteDialogOpen}
        title="Permanently delete lead / job?"
        recordName={formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}
        description="Permanent beta cleanup: this deletes the job plus its tasks, appointments, activities, internal job conversations, email records, files, and photos. The customer record remains. This cannot be undone."
        confirmLabel="Permanently delete"
        onOpenChange={setDeleteDialogOpen}
        onConfirm={async () => {
          await deleteLeadAction(job.id);
          router.push("/leads");
          router.refresh();
        }}
      />
    </form>
  );
}
