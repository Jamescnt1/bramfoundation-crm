import Image from "next/image";
import { notFound } from "next/navigation";
import PrintJobSheetActions from "@/components/jobs/PrintJobSheetActions";
import type { JobContactSummary } from "@/lib/services/jobs";
import { formatAppointmentType } from "@/lib/appointment-display";
import { formatDateTime } from "@/lib/date-time";
import { getAppointmentsByJobId } from "@/lib/services/appointments";
import { getCompanySettings } from "@/lib/services/company-settings";
import { getCustomerById } from "@/lib/services/customers";
import { getActiveEmployees, hasPermission, requireEmployee } from "@/lib/services/employees";
import { getJobById } from "@/lib/services/jobs";
import { getJobNotes, type JobNote } from "@/lib/services/job-notes";
import { getJobMaterialScopes } from "@/lib/services/production";

type PrintQuery = {
  contacts?: string | string[];
  schedule?: string | string[];
  production?: string | string[];
  jobNotes?: string | string[];
  employeeNotes?: string | string[];
  accessCode?: string | string[];
};

export default async function PrintJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PrintQuery>;
}) {
  await requireEmployee();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const options = {
    contacts: enabled(query.contacts, true),
    schedule: enabled(query.schedule, true),
    production: enabled(query.production, true),
    jobNotes: enabled(query.jobNotes, true),
    employeeNotes: enabled(query.employeeNotes, false),
    accessCode: enabled(query.accessCode, false),
  };

  const job = await getJobById(id);
  if (!job) notFound();

  const canViewEmployeeNotes = options.employeeNotes
    ? await safe(hasPermission("job_notes.view"), false)
    : false;
  const [company, customer, employees, appointments, materialScopes, notes] = await Promise.all([
    getCompanySettings(),
    job.customer_id ? safe(getCustomerById(job.customer_id), null) : Promise.resolve(null),
    safe(getActiveEmployees(), []),
    options.schedule ? safe(getAppointmentsByJobId(job.id), []) : Promise.resolve([]),
    options.production ? safe(getJobMaterialScopes(job.id), []) : Promise.resolve([]),
    canViewEmployeeNotes ? safe(getJobNotes(job.id), []) : Promise.resolve([]),
  ]);

  const assignedEmployee = employees.find((employee) => employee.id === job.assigned_employee_id);
  const upcomingAppointments = appointments
    .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.ends_at ?? appointment.starts_at) >= new Date())
    .sort((first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime());
  const visibleAppointments = upcomingAppointments.slice(0, 6);
  const visibleScopes = materialScopes.slice(0, 8);
  const employeeNotes = (notes as JobNote[]).filter((note) => note.source === "manual").slice(0, 3);
  const customerName = customer?.full_name ?? job.customer?.full_name ?? job.project_customer_name ?? "Not provided";

  return (
    <main className="job-print-page min-h-screen bg-gray-100 p-4 sm:p-6">
      <PrintJobSheetActions jobId={job.id} />
      <article className="job-print-sheet mx-auto max-w-[8.5in] bg-white p-6 text-[10px] leading-[1.35] text-gray-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-5 border-b-2 border-slate-800 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            {company.logo_url ? (
              <Image
                src={company.logo_url}
                alt={`${company.company_name} logo`}
                width={150}
                height={64}
                unoptimized
                className="max-h-14 w-auto max-w-36 object-contain"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Job Handoff Sheet</p>
              <h1 className="truncate text-xl font-bold leading-tight text-slate-950">{job.customer_name}</h1>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">{customerName}</p>
            </div>
          </div>
          <div className="shrink-0 text-right text-[9px] text-slate-600">
            <p className="text-xs font-bold text-slate-950">{company.company_name}</p>
            {company.phone ? <p>{company.phone}</p> : null}
            {company.email ? <p>{company.email}</p> : null}
            <p className="mt-1">Prepared {formatDateTime(new Date(), { month: "short", day: "numeric", year: "numeric" }, company.timezone)}</p>
          </div>
        </header>

        <section className="mt-3 grid grid-cols-4 gap-2 rounded-md border border-blue-200 bg-blue-50/70 p-2.5">
          <Summary label="QF Job #" value={job.qfloors_job_number || "Not assigned"} />
          <Summary label="Pipeline status" value={titleCase(job.status)} />
          <Summary label="Salesperson" value={assignedEmployee?.name ?? job.salesperson ?? "Unassigned"} />
          <Summary label="Next action due" value={job.next_action_due ? formatDateOnly(job.next_action_due) : "No due date"} />
          <Summary className="col-span-2" label="Project address" value={job.address || "Not provided"} />
          <Summary label="Project phone" value={job.phone || customer?.phone || "Not provided"} />
          <Summary label="Project email" value={job.email || customer?.email || "Not provided"} />
          {options.accessCode ? <Summary className="col-span-2" label="Lock-box / access code" value={job.lock_box_code || "Not provided"} sensitive /> : null}
        </section>

        {options.contacts ? (
          <PrintSection title="Contacts">
            <div className="grid grid-cols-3 gap-2">
              <ContactBlock title="Company contact" contact={job.company_contact} fallbackName={customer?.full_name} fallbackPhone={customer?.phone} fallbackEmail={customer?.email} />
              <ContactBlock title="Project contact" contact={job.project_contact} fallbackName={job.project_contact_name} fallbackPhone={job.project_contact_phone} description={job.project_contact_description} />
              <ContactBlock title="Job-site contact" contact={job.job_site_contact} />
            </div>
          </PrintSection>
        ) : null}

        <div className="mt-3 grid grid-cols-2 items-start gap-3">
          {options.schedule ? (
            <PrintSection title="Upcoming schedule" compact>
              {visibleAppointments.length ? (
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                  {visibleAppointments.map((appointment) => (
                    <div key={appointment.id} className="grid grid-cols-[7rem_1fr] gap-2 px-2 py-1.5">
                      <p className="font-bold text-slate-800">
                        {formatDateTime(appointment.starts_at, { month: "short", day: "numeric", hour: appointment.all_day ? undefined : "numeric", minute: appointment.all_day ? undefined : "2-digit" }, company.timezone)}
                      </p>
                      <div className="min-w-0">
                        <p className="font-semibold">{formatAppointmentType(appointment.appointment_type, appointment.appointment_type_record?.name)}</p>
                        <p className="text-slate-600">{appointment.installer_crew?.name ?? appointment.assigned_employee?.name ?? appointment.location ?? "Assignment not set"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyText>No upcoming appointments.</EmptyText>}
              {upcomingAppointments.length > visibleAppointments.length ? <MoreText count={upcomingAppointments.length - visibleAppointments.length} label="appointments" /> : null}
            </PrintSection>
          ) : null}

          {options.production ? (
            <PrintSection title="Production" compact>
              {visibleScopes.length ? (
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                  {visibleScopes.map((scope) => {
                    const installation = scope.appointments
                      .filter((appointment) => appointment.appointment_type === "installation" && appointment.status !== "cancelled")
                      .sort((first, second) => first.starts_at.localeCompare(second.starts_at))[0];
                    return (
                      <div key={scope.id} className="grid grid-cols-[1fr_5.5rem] gap-2 px-2 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{scope.description || scope.category?.name || "Production scope"}</p>
                          <p className="truncate text-slate-600">{installation?.installer_name ?? "Installer not assigned"}{scope.issue_note ? ` · Issue: ${truncate(scope.issue_note, 80)}` : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{materialStatus(scope.material_status)}</p>
                          <p className="text-slate-600">ETA {scope.eta_date ? formatDateOnly(scope.eta_date) : "not set"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyText>No production scopes.</EmptyText>}
              {materialScopes.length > visibleScopes.length ? <MoreText count={materialScopes.length - visibleScopes.length} label="production scopes" /> : null}
            </PrintSection>
          ) : null}
        </div>

        {options.jobNotes && job.notes ? (
          <PrintSection title="Job information notes">
            <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">{truncate(job.notes, 900)}</p>
          </PrintSection>
        ) : null}

        {options.employeeNotes ? (
          <PrintSection title="Recent employee notes" titleSuffix="Internal">
            {!canViewEmployeeNotes ? (
              <EmptyText>Employee notes were omitted because your role does not have permission to view them.</EmptyText>
            ) : employeeNotes.length ? (
              <div className="grid grid-cols-3 gap-2">
                {employeeNotes.map((note) => (
                  <div key={note.id} className="rounded-md border border-amber-200 bg-amber-50/60 px-2 py-1.5">
                    <p className="font-bold text-slate-800">{note.author?.name ?? "Employee"} · {formatDateTime(note.created_at, { month: "short", day: "numeric", year: "numeric" }, company.timezone)}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{truncate(note.body, 240)}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyText>No recent employee notes.</EmptyText>}
          </PrintSection>
        ) : null}

        <footer className="mt-3 flex items-center justify-between border-t border-slate-300 pt-2 text-[8px] text-slate-500">
          <p>Generated from Foundation CRM · Verify current schedule and site conditions before work begins.</p>
          <p>Job {job.qfloors_job_number ? `QF# ${job.qfloors_job_number}` : job.id.slice(0, 8)}</p>
        </footer>
      </article>
      <style>{`@media print { @page { size: letter portrait; margin: 0.38in; } body:has(.job-print-page) .foundation-app > div > div > header { display: none !important; } .job-print-page { min-height: auto !important; padding: 0 !important; background: white !important; } .job-print-sheet { font-size: 9px !important; line-height: 1.25 !important; } }`}</style>
    </main>
  );
}

function PrintSection({ children, title, titleSuffix, compact = false }: { children: React.ReactNode; title: string; titleSuffix?: string; compact?: boolean }) {
  return <section className={`${compact ? "mt-0" : "mt-3"} break-inside-avoid`}><div className="mb-1.5 flex items-center gap-2"><h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-800">{title}</h2>{titleSuffix ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-800">{titleSuffix}</span> : null}</div>{children}</section>;
}

function Summary({ label, value, className = "", sensitive = false }: { label: string; value: string; className?: string; sensitive?: boolean }) {
  return <div className={className}><dt className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{label}{sensitive ? " · Sensitive" : ""}</dt><dd className="mt-0.5 break-words font-semibold text-slate-950">{value}</dd></div>;
}

function ContactBlock({ title, contact, fallbackName, fallbackPhone, fallbackEmail, description }: { title: string; contact: JobContactSummary | null; fallbackName?: string | null; fallbackPhone?: string | null; fallbackEmail?: string | null; description?: string | null }) {
  const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : fallbackName;
  const phone = contact?.mobile_phone ?? contact?.office_phone ?? fallbackPhone;
  const email = contact?.email ?? fallbackEmail;
  return <div className="rounded-md border border-slate-200 px-2 py-1.5"><p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-0.5 font-bold">{name || "Not provided"}</p>{contact?.job_title || description ? <p className="text-slate-600">{contact?.job_title ?? description}</p> : null}{phone ? <p>{phone}</p> : null}{email ? <p className="break-all">{email}</p> : null}</div>;
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-300 px-2 py-2 text-slate-500">{children}</p>;
}

function MoreText({ count, label }: { count: number; label: string }) {
  return <p className="mt-1 text-right text-[8px] font-semibold text-slate-500">+ {count} additional {label} in Foundation CRM</p>;
}

function enabled(value: string | string[] | undefined, fallback: boolean) {
  if (Array.isArray(value)) value = value[0];
  if (value === undefined) return fallback;
  return value === "1" || value === "true";
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try { return await promise; } catch { return fallback; }
}

function formatDateOnly(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: value.length === 10 ? "UTC" : undefined }).format(date);
}

function materialStatus(value: string) {
  const labels: Record<string, string> = { needs_ordering: "Needs ordering", ordered: "Ordered", partially_received: "Partially received", ready: "Ready", issue: "Issue", excluded: "Excluded" };
  return labels[value] ?? titleCase(value);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function truncate(value: string, length: number) {
  const clean = value.trim();
  return clean.length > length ? `${clean.slice(0, length - 1).trimEnd()}…` : clean;
}
