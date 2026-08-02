import { createClient } from "@/lib/supabase/server";
import type { Employee } from "@/lib/services/employees";
import type { CalendarAppointment } from "@/components/calendar/types";

export type WorkspaceTask = {
  id: string;
  job_id: string | null;
  customer_id: string | null;
  title: string;
  due_at: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  completed: boolean;
  task_type_id: string | null;
  task_types: { id: string; name: string } | null;
  latest_note: { id: string; body: string; created_at: string } | null;
  jobs: { id: string; customer_name: string; qfloors_job_number: string | null; customer: { id: string; full_name: string } | null } | null;
  customers: { id: string; full_name: string } | null;
};

export type WorkspaceAppointment = CalendarAppointment;

export type WorkspaceJob = {
  id: string;
  customer_name: string;
  status: string;
  next_action: string | null;
  next_action_due: string | null;
  qfloors_job_number: string | null;
  customer: { id: string; full_name: string } | null;
};

export type EmployeeWorkspace = {
  tasks: WorkspaceTask[];
  appointments: WorkspaceAppointment[];
  installations: WorkspaceAppointment[];
  jobs: WorkspaceJob[];
};

const workspaceAppointmentColumns = `
  *,
  appointment_type_record:appointment_types!appointments_appointment_type_fkey (
    key, name, active
  ),
  assigned_employee:employees!appointments_assigned_employee_id_fkey (
    id, name, color
  ),
  installer_crew:installer_crews!appointments_installer_crew_id_fkey (
    id, name, color
  ),
  work_order_sender:employees!appointments_work_order_sent_by_fkey (
    id, name
  ),
  job:jobs!appointments_job_id_fkey (
    id, customer_id, customer_name, qfloors_job_number, address, status,
    installation_required,
    customer:customers!jobs_customer_id_fkey (id, full_name),
    company_contact:customer_contacts!jobs_company_contact_id_fkey (
      first_name, last_name, job_title, email, office_phone, mobile_phone
    ),
    job_site_contact:customer_contacts!jobs_job_site_contact_id_fkey (
      first_name, last_name, job_title, email, office_phone, mobile_phone
    )
  )
`;

export async function getEmployeeWorkspace(
  employee: Employee,
): Promise<EmployeeWorkspace> {
  const supabase = await createClient();
  const now = new Date();
  const appointmentWindowEnd = new Date(now);
  appointmentWindowEnd.setDate(appointmentWindowEnd.getDate() + 14);

  const [tasksResult, jobsResult] = await Promise.all([
    supabase
      .from("job_tasks")
      .select("id, job_id, customer_id, title, due_at, due_date, priority, status, completed, task_type_id, task_types(id, name), jobs(id, customer_name, qfloors_job_number, customer:customers!jobs_customer_id_fkey(id, full_name)), customers(id, full_name)")
      .or(`assigned_employee_id.eq.${employee.id},assigned_to.eq.${escapeFilterValue(employee.name)}`)
      .order("completed", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("jobs")
      .select("id, customer_name, status, next_action, next_action_due, qfloors_job_number, customer:customers!jobs_customer_id_fkey(id, full_name)")
      .is("archived_at", null)
      .eq("on_hold", false)
      .or(`assigned_employee_id.eq.${employee.id},salesperson.eq.${escapeFilterValue(employee.name)}`)
      .order("updated_at", { ascending: false }),
  ]);

  const error = tasksResult.error ?? jobsResult.error;
  if (error) throw new Error(error.message);

  const jobIds = (jobsResult.data ?? []).map((job) => job.id);
  const appointmentsQuery = supabase
    .from("appointments")
    .select(workspaceAppointmentColumns)
    .eq("assigned_employee_id", employee.id)
    .neq("appointment_type", "installation")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", appointmentWindowEnd.toISOString())
    .order("starts_at");
  const installationsQuery = jobIds.length
    ? supabase
        .from("appointments")
        .select(workspaceAppointmentColumns)
        .eq("appointment_type", "installation")
        .in("job_id", jobIds)
        .or(`starts_at.gte.${now.toISOString()},ends_at.gte.${now.toISOString()}`)
        .lte("starts_at", appointmentWindowEnd.toISOString())
        .order("starts_at")
    : null;
  const [appointmentsResult, installationsResult] = await Promise.all([
    appointmentsQuery,
    installationsQuery,
  ]);
  if (appointmentsResult.error) throw new Error(appointmentsResult.error.message);
  if (installationsResult?.error) throw new Error(installationsResult.error.message);

  const normalizedTasks = (tasksResult.data ?? []).map((task) => ({
    ...task,
    jobs: normalizeWorkspaceJobRelation(
      Array.isArray(task.jobs) ? task.jobs[0] ?? null : task.jobs,
    ),
    customers: Array.isArray(task.customers) ? task.customers[0] ?? null : task.customers,
    task_types: Array.isArray(task.task_types) ? task.task_types[0] ?? null : task.task_types,
    latest_note: null,
  })) as WorkspaceTask[];

  const latestNotesByTask = new Map<string, WorkspaceTask["latest_note"]>();
  if (normalizedTasks.length) {
    const { data: latestNotes, error: latestNotesError } = await supabase
      .from("task_latest_notes")
      .select("id, task_id, body, created_at")
      .in("task_id", normalizedTasks.map((task) => task.id))
      .order("created_at", { ascending: false });
    if (latestNotesError) throw new Error(latestNotesError.message);
    for (const note of latestNotes ?? []) {
      if (!latestNotesByTask.has(note.task_id)) {
        latestNotesByTask.set(note.task_id, {
          id: note.id,
          body: note.body,
          created_at: note.created_at,
        });
      }
    }
  }
  const tasks = normalizedTasks.map((task) => ({
    ...task,
    latest_note: latestNotesByTask.get(task.id) ?? null,
  }));

  const appointments = (appointmentsResult.data ?? []) as unknown as WorkspaceAppointment[];
  const installations = (installationsResult?.data ?? []) as unknown as WorkspaceAppointment[];

  const jobs = (jobsResult.data ?? []).map((job) => ({
    ...job,
    customer: Array.isArray(job.customer) ? job.customer[0] ?? null : job.customer,
  })) as WorkspaceJob[];

  return {
    tasks,
    appointments,
    installations,
    jobs,
  };
}

function normalizeWorkspaceJobRelation<T extends { customer?: unknown }>(job: T | null) {
  if (!job) return null;
  return {
    ...job,
    customer: Array.isArray(job.customer) ? job.customer[0] ?? null : job.customer ?? null,
  };
}

function escapeFilterValue(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}
