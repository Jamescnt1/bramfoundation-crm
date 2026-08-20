"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import {
  archiveCustomerContactAction,
} from "@/app/actions/customer-contacts";
import ContactFormDialog from "@/components/contacts/ContactFormDialog";
import type { Customer } from "@/components/customers/types";
import { formatJobDisplayName } from "@/lib/job-display";
import type { Job } from "@/lib/services/jobs";
import { getPipelineStage } from "@/components/pipeline/constants";
import {
  formatContactName,
  type CustomerContact,
} from "@/lib/services/customer-contacts";
import { EmailLink, PhoneLink } from "@/components/contact/ActionableContactLinks";

type Props = {
  customer: Customer;
  initialContacts: CustomerContact[];
  canManage: boolean;
  canArchive: boolean;
};

export default function CustomerContactsManager({
  customer,
  initialContacts,
  canManage,
  canArchive,
}: Props) {
  const [contacts, setContacts] = useState(initialContacts);
  const [editing, setEditing] = useState<CustomerContact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function archive(contact: CustomerContact) {
    if (!window.confirm(`Archive ${formatContactName(contact)}? Linked jobs will keep their history, but this contact will no longer be selectable.`)) return;
    setError("");
    try {
      const result = await archiveCustomerContactAction(contact.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setContacts((current) => current.filter((item) => item.id !== contact.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to archive contact.");
    }
  }

  return (
    <section id="contacts" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Contacts</h2>
          <p className="mt-1 text-sm text-gray-500">{contacts.filter((contact) => contact.active).length} active {contacts.filter((contact) => contact.active).length === 1 ? "contact" : "contacts"} at {customer.full_name}.</p>
        </div>
        {canManage ? (
          <button type="button" onClick={openCreate} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
            <Plus className="h-4 w-4" /> New Contact
          </button>
        ) : null}
      </div>

      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {contacts.length ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {contacts.map((contact) => (
            <article key={contact.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-950">{formatContactName(contact)}</h3>
                    {!contact.active ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Inactive</span> : null}
                  </div>
                  <p className="text-sm text-gray-500">{contact.job_title ?? "Contact"}</p>
                </div>
                <div className="flex gap-1">
                  {canManage ? <button type="button" onClick={() => { setEditing(contact); setDialogOpen(true); }} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Edit contact"><Pencil className="h-4 w-4" /></button> : null}
                  {canArchive ? <button type="button" onClick={() => void archive(contact)} className="rounded-md p-2 text-red-600 hover:bg-red-50" aria-label="Archive contact"><Trash2 className="h-4 w-4" /></button> : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                <PhoneLink value={contact.mobile_phone} label={formatContactName(contact)} showIcon className="text-gray-700" />
                <PhoneLink value={contact.office_phone} label={`${formatContactName(contact)} office`} showIcon className="text-gray-700" />
                <EmailLink value={contact.email} label={formatContactName(contact)} showIcon className="text-gray-700" />
              </div>
              {contact.jobs?.length ? <ContactJobs jobs={contact.jobs} /> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">No contacts have been added for this customer.</div>
      )}

      <ContactFormDialog
        key={`${editing?.id ?? "new"}-${dialogOpen}`}
        open={dialogOpen}
        customers={[customer]}
        defaultCustomerId={customer.id}
        contact={editing}
        lockCustomer
        onClose={() => setDialogOpen(false)}
        onSaved={(saved) => setContacts((current) => {
          const exists = current.some((item) => item.id === saved.id);
          return exists ? current.map((item) => item.id === saved.id ? { ...item, ...saved, customer: { id: customer.id, full_name: customer.full_name } } : item) : [{ ...saved, customer: { id: customer.id, full_name: customer.full_name }, jobs: [] }, ...current];
        })}
      />
    </section>
  );
}

const COLLAPSED_JOB_COUNT = 4;

function ContactJobs({ jobs }: { jobs: Job[] }) {
  const [showAllCurrent, setShowAllCurrent] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const currentJobs = jobs.filter((job) => !isHistoryJob(job));
  const historyJobs = jobs.filter(isHistoryJob);
  const visibleCurrentJobs = showAllCurrent ? currentJobs : currentJobs.slice(0, COLLAPSED_JOB_COUNT);
  const hiddenCurrentCount = Math.max(0, currentJobs.length - COLLAPSED_JOB_COUNT);

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Current jobs · {currentJobs.length}
      </p>
      {currentJobs.length ? (
        <div className={`mt-1 space-y-1 ${showAllCurrent ? "max-h-64 overflow-y-auto pr-1" : ""}`}>
          {visibleCurrentJobs.map((job) => <ContactJobLink key={job.id} job={job} />)}
        </div>
      ) : <p className="mt-1 text-xs text-gray-500">No current jobs.</p>}
      {hiddenCurrentCount ? (
        <button
          type="button"
          onClick={() => setShowAllCurrent((current) => !current)}
          aria-expanded={showAllCurrent}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
        >
          {showAllCurrent ? "Show fewer" : `Show ${hiddenCurrentCount} more`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllCurrent ? "rotate-180" : ""}`} />
        </button>
      ) : null}

      {historyJobs.length ? (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => setShowHistory((current) => !current)}
            aria-expanded={showHistory}
            className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800"
          >
            <span>Job history · {historyJobs.length}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`} />
          </button>
          {showHistory ? (
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
              {historyJobs.map((job) => <ContactJobLink key={job.id} job={job} />)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ContactJobLink({ job }: { job: Job }) {
  return (
    <Link href={`/leads/${job.id}`} className="block truncate text-sm font-medium text-gray-700 hover:underline">
      {formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}
    </Link>
  );
}

function isHistoryJob(job: Job) {
  const normalizedStatus = job.status.trim().toLowerCase().replaceAll("_", " ");
  const legacyStage = getPipelineStage(job.status);
  return Boolean(job.billed_at)
    || legacyStage === "Complete"
    || legacyStage === "Lost"
    || ["completed", "closed", "billed", "billed jobs"].includes(normalizedStatus);
}
