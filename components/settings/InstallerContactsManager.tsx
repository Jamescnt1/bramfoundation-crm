"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createInstallerContactAction,
  retireInstallerContactAction,
  updateInstallerContactAction,
} from "@/app/settings/install-crews/actions";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import type { InstallerContact, InstallerContactValues, InstallerPreferredChannel } from "@/lib/services/installer-contacts";

const blankContact = (crewId: string): InstallerContactValues => ({
  installer_crew_id: crewId,
  name: "",
  mobile_phone: null,
  email: null,
  preferred_channel: "none",
  appointment_confirmations: true,
  appointment_reminders: true,
  schedule_changes: true,
  trial_recipient_verified: false,
  active: true,
});

export default function InstallerContactsManager({ crews, initialContacts }: { crews: InstallerCrew[]; initialContacts: InstallerContact[] }) {
  const activeCrews = crews.filter((crew) => crew.active);
  const [contacts, setContacts] = useState(initialContacts);
  const [editing, setEditing] = useState<InstallerContact | null>(null);
  const [values, setValues] = useState<InstallerContactValues>(() => blankContact(activeCrews[0]?.id ?? ""));
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const crewById = useMemo(() => new Map(crews.map((crew) => [crew.id, crew])), [crews]);

  function openNew() {
    setEditing(null); setValues(blankContact(activeCrews[0]?.id ?? "")); setFormOpen(true); setMessage(""); setError("");
  }
  function openEdit(contact: InstallerContact) {
    setEditing(contact); setValues({ ...contact }); setFormOpen(true); setMessage(""); setError("");
  }
  function closeForm() { setFormOpen(false); setEditing(null); setError(""); }
  function set<K extends keyof InstallerContactValues>(key: K, value: InstallerContactValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const saved = editing
        ? await updateInstallerContactAction(editing.id, values)
        : await createInstallerContactAction(values);
      setContacts((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setMessage(`${saved.name}'s communication preferences saved.`); closeForm();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save the installer contact."); }
    finally { setBusy(false); }
  }

  async function retire(contact: InstallerContact) {
    if (!window.confirm(`Retire ${contact.name}? Their history will remain, but they will not receive new notifications.`)) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const saved = await retireInstallerContactAction(contact.id);
      setContacts((current) => current.map((item) => item.id === saved.id ? saved : item));
      setMessage(`${saved.name} was retired and will not receive new notifications.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to retire the installer contact."); }
    finally { setBusy(false); }
  }

  return <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Installer contacts and notifications</h2><p className="mt-1 max-w-2xl text-sm text-gray-500">Add the individual people within each crew and choose how they want to receive confirmations, reminders, and schedule changes.</p></div><Button type="button" onClick={openNew} disabled={busy || !activeCrews.length}><Plus /> Add installer contact</Button></div>
    {message ? <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
    {error ? <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

    {formOpen ? <form onSubmit={save} className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-blue-950">{editing ? `Edit ${editing.name}` : "New installer contact"}</h3><Button type="button" size="icon-sm" variant="ghost" onClick={closeForm} aria-label="Close installer form"><X /></Button></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Install crew"><select value={values.installer_crew_id} onChange={(event) => set("installer_crew_id", event.target.value)} className={inputClass} required>{activeCrews.map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}</select></Field>
        <Field label="Installer name"><Input value={values.name} onChange={(event) => set("name", event.target.value)} required /></Field>
        <Field label="Mobile number"><Input type="tel" value={values.mobile_phone ?? ""} onChange={(event) => set("mobile_phone", event.target.value)} placeholder="(602) 555-0123" /></Field>
        <Field label="Email"><Input type="email" value={values.email ?? ""} onChange={(event) => set("email", event.target.value)} placeholder="installer@example.com" /></Field>
        <Field label="Preferred delivery"><select value={values.preferred_channel} onChange={(event) => set("preferred_channel", event.target.value as InstallerPreferredChannel)} className={inputClass}><option value="none">Do not send notifications</option><option value="email">Email only</option><option value="sms">Text only</option><option value="both">Email and text</option></select></Field>
        <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><input type="checkbox" checked={values.trial_recipient_verified} onChange={(event) => set("trial_recipient_verified", event.target.checked)} className="mt-1" /><span><strong className="block text-sm text-amber-950">Verified Twilio trial number</strong><span className="text-xs text-amber-800">Turn this on only after this mobile number is verified in Twilio.</span></span></label>
      </div>
      <fieldset className="mt-4"><legend className="text-sm font-semibold text-gray-800">What should this installer receive?</legend><div className="mt-2 grid gap-2 sm:grid-cols-3"><Preference label="Appointment confirmations" checked={values.appointment_confirmations} onChange={(checked) => set("appointment_confirmations", checked)} /><Preference label="Appointment reminders" checked={values.appointment_reminders} onChange={(checked) => set("appointment_reminders", checked)} /><Preference label="Schedule changes" checked={values.schedule_changes} onChange={(checked) => set("schedule_changes", checked)} /></div></fieldset>
      {editing ? <label className="mt-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={values.active} onChange={(event) => set("active", event.target.checked)} />Active installer contact</label> : null}
      <p className="mt-4 text-xs text-blue-800">Saving preferences does not send a message. Live test texting is added in the next phase.</p>
      <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeForm} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save installer contact"}</Button></div>
    </form> : null}

    <div className="mt-5 space-y-3">{contacts.length ? contacts.map((contact) => <article key={contact.id} className={`rounded-xl border p-4 ${contact.active ? "border-gray-200" : "border-gray-200 bg-gray-50 opacity-70"}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="rounded-lg bg-gray-100 p-2 text-gray-500"><UserRound className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900">{contact.name}</h3><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{crewById.get(contact.installer_crew_id)?.name ?? "Unknown crew"}</span>{!contact.active ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Retired</span> : null}</div><p className="mt-1 text-sm text-gray-500">{[contact.email, contact.mobile_phone].filter(Boolean).join(" · ")}</p><p className="mt-2 text-sm text-gray-700">{channelLabel(contact.preferred_channel)} · {enabledTopics(contact)}</p>{contact.trial_recipient_verified ? <p className="mt-1 text-xs font-medium text-green-700">Marked as verified for Twilio trial testing</p> : null}</div></div><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => openEdit(contact)} disabled={busy}><Pencil /> Edit</Button>{contact.active ? <Button type="button" variant="outline" onClick={() => void retire(contact)} disabled={busy}>Retire</Button> : null}</div></div></article>) : <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No installer contacts yet. Add the individual people who should receive schedule communication.</div>}</div>
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium text-gray-700"><span>{label}</span>{children}</label>; }
function Preference({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
function channelLabel(channel: InstallerPreferredChannel) { return channel === "both" ? "Email and text" : channel === "sms" ? "Text only" : channel === "email" ? "Email only" : "Notifications off"; }
function enabledTopics(contact: InstallerContact) { const topics = [contact.appointment_confirmations && "confirmations", contact.appointment_reminders && "reminders", contact.schedule_changes && "schedule changes"].filter(Boolean); return topics.length ? topics.join(", ") : "no notification types"; }
const inputClass = "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm";
