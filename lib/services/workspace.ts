import { createClient } from "@/lib/supabase/server";
import type { Employee } from "@/lib/services/employees";
import type { AppointmentType } from "@/components/calendar/constants";

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

export type WorkspaceAppointment = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  appointment_type: AppointmentType;
  status: string;
  location: string | null;
  job: {
    id: string;
    customer_name: string;
    qfloors_job_number: string | null;
    customer: { id: string; full_name: string } | null;
  } | null;
};

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
  jobs: WorkspaceJob[];
};

export async function getEmployeeWorkspace(
  employee: Employee,
): Promise<EmployeeWorkspace> {
  const supabase = await createClient();
  const now = new Date();
  const appointmentWindowEnd = new Date(now);
  appointmentWindowEnd.setDate(appointmentWindowEnd.getDate() + 14);

  const [tasksResult, appointmentsResult, jobsResult] = await Promise.all([
    supabase
      .from("job_tasks")
      .select("id, job_id, customer_id, title, due_at, due_date, priority, status, completed, task_type_id, task_types(id, name), jobs(id, customer_name, qfloors_job_number, customer:customers!jobs_customer_id_fkey(id, full_name)), customers(id, full_name)")
      .or(`automation_rule_id.is.null,due_at.is.null,due_at.lte.${now.toISOString()}`)
      .or(`assigned_employee_id.eq.${employee.id},assigned_to.eq.${escapeFilterValue(employee.name)}`)
      .order("completed", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, appointment_type, status, location, job:jobs!appointments_job_id_fkey(id, customer_name, qfloors_job_number, customer:customers!jobs_customer_id_fkey(id, full_name))")
      .eq("assigned_employee_id", employee.id)
      .gte("starts_at", now.toISOString())
      .lte("starts_at", appointmentWindowEnd.toISOString())
      .order("starts_at"),
    supabase
      .from("jobs")
      .select("id, customer_name, status, next_action, next_action_due, qfloors_job_number, customer:customers!jobs_customer_id_fkey(id, full_name)")
      .is("archived_at", null)
      .or(`assigned_employee_id.eq.${employee.id},salesperson.eq.${escapeFilterValue(employee.name)}`)
      .order("updated_at", { ascending: false }),
  ]);

  const error = tasksResult.error ?? appointmentsResult.error ?? jobsResult.error;
  if (error) throw new Error(error.message);

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

  const appointments = (appointmentsResult.data ?? []).map((appointment) => ({
    ...appointment,
    job: normalizeWorkspaceJobRelation(
      Array.isArray(appointment.job) ? appointment.job[0] ?? null : appointment.job,
    ),
  })) as WorkspaceAppointment[];

  const jobs = (jobsResult.data ?? []).map((job) => ({
    ...job,
    customer: Array.isArray(job.customer) ? job.customer[0] ?? null : job.customer,
  })) as WorkspaceJob[];

  return {
    tasks,
    appointments,
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
