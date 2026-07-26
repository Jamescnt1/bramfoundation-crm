"use client";

import { type FormEvent, useState } from "react";
import { X } from "lucide-react";
import type { Customer } from "@/components/customers/types";
import {
  createCustomerContactAction,
  updateCustomerContactAction,
} from "@/app/actions/customer-contacts";
import type { CustomerContact } from "@/lib/services/customer-contacts";

type Props = {
  open: boolean;
  customers: Customer[];
  defaultCustomerId: string;
  contact?: CustomerContact | null;
  lockCustomer?: boolean;
  onClose: () => void;
  onSaved: (contact: CustomerContact) => void;
};

const fieldClass =
  "mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200";

export default function ContactFormDialog({
  open,
  customers,
  defaultCustomerId,
  contact,
  lockCustomer = false,
  onClose,
  onSaved,
}: Props) {
  const [customerId, setCustomerId] = useState(contact?.customer_id ?? defaultCustomerId);
  const [firstName, setFirstName] = useState(contact?.first_name ?? "");
  const [lastName, setLastName] = useState(contact?.last_name ?? "");
  const [jobTitle, setJobTitle] = useState(contact?.job_title ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [officePhone, setOfficePhone] = useState(contact?.office_phone ?? "");
  const [mobilePhone, setMobilePhone] = useState(contact?.mobile_phone ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [active, setActive] = useState(contact?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const values = {
        customer_id: customerId,
        first_name: firstName,
        last_name: lastName,
        job_title: jobTitle,
        email,
        office_phone: officePhone,
        mobile_phone: mobilePhone,
        notes,
        active,
      };
      const saved = contact
        ? await updateCustomerContactAction(contact.id, values)
        : await createCustomerContactAction(values);
      onSaved(saved as CustomerContact);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/45 p-3 sm:p-6">
      <div className="flex min-h-full items-start justify-center sm:items-center">
        <form onSubmit={submit} className="my-3 w-full max-w-xl rounded-xl bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div>
              <h2 className="font-semibold text-gray-950">{contact ? "Edit Contact" : "Create New Contact"}</h2>
              <p className="text-xs text-gray-500">Contact details update every linked job.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</div> : null}
            <Field label="Parent customer">
              <select required disabled={saving || lockCustomer} value={customerId} onChange={(event) => setCustomerId(event.target.value)} className={fieldClass}>
                <option value="">Select customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}
              </select>
            </Field>
            <Field label="Job title">
              <input disabled={saving} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className={fieldClass} />
            </Field>
            <Field label="First name" required>
              <input required disabled={saving} value={firstName} onChange={(event) => setFirstName(event.target.value)} className={fieldClass} />
            </Field>
            <Field label="Last name">
              <input disabled={saving} value={lastName} onChange={(event) => setLastName(event.target.value)} className={fieldClass} />
            </Field>
            <Field label="Mobile phone">
              <input type="tel" disabled={saving} value={mobilePhone} onChange={(event) => setMobilePhone(event.target.value)} className={fieldClass} />
            </Field>
            <Field label="Office phone">
              <input type="tel" disabled={saving} value={officePhone} onChange={(event) => setOfficePhone(event.target.value)} className={fieldClass} />
            </Field>
            <Field label="Email">
              <input type="email" disabled={saving} value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active contact
            </label>
            <Field label="Notes" wide>
              <textarea rows={3} disabled={saving} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${fieldClass} resize-y`} />
            </Field>
          </div>
          <footer className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving…" : "Save Contact"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return <label className={`block text-sm font-medium text-gray-700 ${wide ? "sm:col-span-2" : ""}`}>{label}{required ? <span className="text-red-600"> *</span> : null}{children}</label>;
}
