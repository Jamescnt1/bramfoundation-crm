"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";
import type { Customer } from "@/components/customers/types";
import ContactFormDialog from "@/components/contacts/ContactFormDialog";
import {
  formatContactName,
  type CustomerContact,
} from "@/lib/services/customer-contacts";

type Props = {
  label: string;
  value: string;
  contacts: CustomerContact[];
  customers: Customer[];
  parentCustomerId: string;
  restrictToParent?: boolean;
  disabled?: boolean;
  description?: string;
  onChange: (contactId: string, created?: CustomerContact) => void;
};

export default function ContactPicker({
  label,
  value,
  contacts,
  customers,
  parentCustomerId,
  restrictToParent = false,
  disabled,
  description,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const selected = contacts.find((contact) => contact.id === value) ?? null;
  const options = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return contacts
      .filter((contact) => contact.active)
      .filter((contact) => !restrictToParent || contact.customer_id === parentCustomerId)
      .filter((contact) => !normalized || [
        formatContactName(contact),
        contact.email,
        contact.mobile_phone,
        contact.office_phone,
        contact.customer?.full_name,
      ].some((item) => item?.toLowerCase().includes(normalized)))
      .slice(0, 12);
  }, [contacts, parentCustomerId, query, restrictToParent]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative mt-2">
        {selected ? (
          <div className="flex min-h-10 items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{formatContactName(selected)}</p>
              <p className="truncate text-xs text-gray-500">{selected.mobile_phone ?? selected.office_phone ?? selected.email ?? selected.customer?.full_name}</p>
            </div>
            <div className="ml-2 flex items-center"><button type="button" disabled={disabled} onClick={() => setEditOpen(true)} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label={`Edit ${label}`}><Pencil className="h-4 w-4" /></button><button type="button" disabled={disabled} onClick={() => onChange("")} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label={`Clear ${label}`}><X className="h-4 w-4" /></button></div>
          </div>
        ) : (
          <button type="button" disabled={disabled || !parentCustomerId} onClick={() => setOpen((current) => !current)} className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-500 disabled:bg-gray-100">
            <Search className="h-4 w-4" /> Search contacts…
          </button>
        )}
        {open && !selected ? (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, phone, or email" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-1 max-h-52 overflow-y-auto">
              {options.map((contact) => (
                <button key={contact.id} type="button" onClick={() => { onChange(contact.id); setOpen(false); setQuery(""); }} className="block w-full rounded-md px-3 py-2 text-left hover:bg-gray-50">
                  <span className="block text-sm font-medium">{formatContactName(contact)}</span>
                  <span className="block text-xs text-gray-500">{contact.customer?.full_name}{contact.job_title ? ` · ${contact.job_title}` : ""}</span>
                </button>
              ))}
              {!options.length ? <p className="px-3 py-4 text-center text-sm text-gray-500">No matching contacts.</p> : null}
            </div>
            <button type="button" onClick={() => { setOpen(false); setCreateOpen(true); }} className="mt-1 flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-sm font-medium text-gray-900"><Plus className="h-4 w-4" /> Create New Contact</button>
          </div>
        ) : null}
      </div>
      {description ? <p className="mt-1.5 text-xs text-gray-500">{description}</p> : null}
      <ContactFormDialog
        key={`new-${parentCustomerId}-${createOpen}`}
        open={createOpen}
        customers={customers}
        defaultCustomerId={parentCustomerId}
        lockCustomer={restrictToParent}
        onClose={() => setCreateOpen(false)}
        onSaved={(contact) => onChange(contact.id, contact)}
      />
      <ContactFormDialog key={`edit-${selected?.id}-${editOpen}`} open={editOpen} customers={customers} defaultCustomerId={selected?.customer_id ?? parentCustomerId} contact={selected} lockCustomer={restrictToParent} onClose={() => setEditOpen(false)} onSaved={(contact) => onChange(contact.id, contact)} />
    </div>
  );
}
