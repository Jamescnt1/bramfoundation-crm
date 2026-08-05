import "server-only";

import { formatAppointmentDisplayName } from "@/lib/appointment-display";
import { formatJobDisplayName } from "@/lib/job-display";
import type { GlobalSearchResult } from "@/lib/search/types";
import { requireEmployee } from "@/lib/services/employees";
import { createClient } from "@/lib/supabase/server";

const RESULT_LIMIT = 6;
const LEAD_STATUSES = new Set(["new_lead", "new lead", "floor_measure", "floor measure"]);

function searchPattern(query: string) {
  return `%${query.replace(/[%_\\]/g, "\\$&")}%`;
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

export async function searchFoundationCrm(rawQuery: string): Promise<GlobalSearchResult[]> {
  await requireEmployee();
  const query = rawQuery.trim().slice(0, 80);
  if (query.length < 2) return [];

  const supabase = await createClient();
  const pattern = searchPattern(query);

  const [customersResult, contactsResult, jobsResult, tasksResult, appointmentsResult, employeesResult, filesResult] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .is("archived_at", null)
        .or(`full_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
        .order("full_name")
        .limit(RESULT_LIMIT),
      supabase
        .from("customer_contacts")
        .select("id, customer_id, first_name, last_name, job_title, email, office_phone, mobile_phone, customer:customers!customer_contacts_customer_id_fkey(full_name)")
        .is("archived_at", null)
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},office_phone.ilike.${pattern},mobile_phone.ilike.${pattern}`)
        .order("last_name")
        .limit(RESULT_LIMIT),
      supabase
        .from("jobs")
        .select("id, customer_name, project_customer_name, project_contact_name, project_contact_phone, project_contact_description, qfloors_job_number, status, on_hold, hold_until, customer:customers!jobs_customer_id_fkey(full_name)")
        .is("archived_at", null)
        .or(`customer_name.ilike.${pattern},project_customer_name.ilike.${pattern},project_contact_name.ilike.${pattern},project_contact_phone.ilike.${pattern},project_contact_description.ilike.${pattern},qfloors_job_number.ilike.${pattern}`)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(RESULT_LIMIT * 2),
      supabase
        .from("job_tasks")
        .select("id, title, due_date, completed, job:jobs!job_tasks_job_id_fkey(id, customer_name, qfloors_job_number, customer:customers!jobs_customer_id_fkey(full_name))")
        .ilike("title", pattern)
        .order("created_at", { ascending: false })
        .limit(RESULT_LIMIT),
      supabase
        .from("appointments")
        .select("id, title, appointment_type, starts_at, job:jobs!appointments_job_id_fkey(id, customer_name, qfloors_job_number, customer:customers!jobs_customer_id_fkey(full_name))")
        .or(`title.ilike.${pattern},appointment_type.ilike.${pattern}`)
        .order("starts_at", { ascending: false })
        .limit(RESULT_LIMIT),
      supabase
        .from("employees")
        .select("id, name, job_title, email")
        .eq("active", true)
        .or(`name.ilike.${pattern},job_title.ilike.${pattern},email.ilike.${pattern}`)
        .order("name")
        .limit(RESULT_LIMIT),
      supabase
        .from("job_attachments")
        .select("id, file_name, attachment_kind, category, job:jobs!job_attachments_job_id_fkey(id, customer_name, qfloors_job_number, customer:customers!jobs_customer_id_fkey(full_name))")
        .is("archived_at", null)
        .or(`file_name.ilike.${pattern},category.ilike.${pattern},description.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(RESULT_LIMIT),
    ]);

  const firstError = [
    customersResult.error,
    contactsResult.error,
    jobsResult.error,
    tasksResult.error,
    appointmentsResult.error,
    employeesResult.error,
    filesResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const results: GlobalSearchResult[] = [];

  for (const customer of customersResult.data ?? []) {
    results.push({
      type: "customer",
      id: customer.id,
      title: customer.full_name,
      subtitle: clean(customer.phone) ?? clean(customer.email),
      href: `/customers/${customer.id}`,
      keywords: [customer.full_name, customer.phone, customer.email].filter(Boolean).join(" "),
    });
  }

  for (const contact of contactsResult.data ?? []) {
    const customer = relation(contact.customer);
    const name = `${contact.first_name} ${contact.last_name}`.trim();
    results.push({
      type: "contact",
      id: contact.id,
      title: name,
      subtitle: [contact.job_title, customer?.full_name, contact.mobile_phone ?? contact.office_phone].filter(Boolean).join(" · ") || contact.email,
      href: `/customers/${contact.customer_id}#contacts`,
      keywords: [name, contact.email, contact.office_phone, contact.mobile_phone, customer?.full_name].filter(Boolean).join(" "),
    });
  }

  for (const job of jobsResult.data ?? []) {
    const customer = relation(job.customer);
    const type = LEAD_STATUSES.has(job.status.toLowerCase()) ? "lead" : "job";
    const title = formatJobDisplayName({
      customerName: customer?.full_name,
      jobName: job.customer_name,
      qfNumber: job.qfloors_job_number,
    });
    results.push({
      type,
      id: job.id,
      title,
      subtitle: [job.project_customer_name, job.project_contact_name, job.on_hold ? `On Hold${job.hold_until ? ` until ${job.hold_until}` : ""} · ${job.status}` : job.status].filter(Boolean).join(" · "),
      href: `/leads/${job.id}`,
      keywords: `${title} ${job.project_customer_name ?? ""} ${job.project_contact_name ?? ""} ${job.project_contact_phone ?? ""} ${job.project_contact_description ?? ""} ${job.status}${job.on_hold ? " on hold" : ""}`,
    });
  }

  for (const task of tasksResult.data ?? []) {
    const job = relation(task.job);
    const customer = relation(job?.customer);
    const context = job
      ? formatJobDisplayName({
          customerName: customer?.full_name,
          jobName: job.customer_name,
          qfNumber: job.qfloors_job_number,
        })
      : null;
    results.push({
      type: "task",
      id: task.id,
      title: task.title,
      subtitle: context ?? (task.completed ? "Completed task" : clean(task.due_date) ? `Due ${task.due_date}` : "Task"),
      href: `/tasks?task=${task.id}`,
      keywords: `${task.title} ${context ?? ""}`,
    });
  }

  for (const appointment of appointmentsResult.data ?? []) {
    const job = relation(appointment.job);
    const customer = relation(job?.customer);
    const title = formatAppointmentDisplayName({
      title: appointment.title,
      customerName: customer?.full_name,
      jobName: job?.customer_name,
      appointmentType: appointment.appointment_type,
    });
    results.push({
      type: "appointment",
      id: appointment.id,
      title,
      subtitle: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(appointment.starts_at)),
      href: `/calendar?appointment=${appointment.id}&date=${appointment.starts_at.slice(0, 10)}`,
      keywords: `${title} ${job?.qfloors_job_number ?? ""}`,
    });
  }

  for (const employee of employeesResult.data ?? []) {
    results.push({
      type: "employee",
      id: employee.id,
      title: employee.name,
      subtitle: clean(employee.job_title) ?? clean(employee.email),
      href: `/settings/employees?employee=${employee.id}`,
      keywords: [employee.name, employee.job_title, employee.email].filter(Boolean).join(" "),
    });
  }

  for (const file of filesResult.data ?? []) {
    const job = relation(file.job);
    const customer = relation(job?.customer);
    const context = job
      ? formatJobDisplayName({
          customerName: customer?.full_name,
          jobName: job.customer_name,
          qfNumber: job.qfloors_job_number,
        })
      : null;
    const tab = file.category === "Layout" ? "layouts" : file.attachment_kind === "photo" ? "photos" : "files";
    results.push({
      type: "file",
      id: file.id,
      title: file.file_name,
      subtitle: context ?? file.category,
      href: job ? `/leads/${job.id}?tab=${tab}` : "/leads",
      keywords: `${file.file_name} ${file.category} ${context ?? ""}`,
    });
  }

  return results;
}
