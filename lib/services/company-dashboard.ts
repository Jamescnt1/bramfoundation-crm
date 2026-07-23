import "server-only";

import { getPipelineStages, type PipelineStageConfig } from "@/lib/services/pipeline-stages";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentType } from "@/components/calendar/constants";
import { formatAppointmentDisplayName } from "@/lib/appointment-display";

const FOLLOW_UP_THRESHOLD_DAYS = numberSetting(
  process.env.COMPANY_DASHBOARD_FOLLOW_UP_DAYS,
  5,
);
const WAITING_APPROVAL_THRESHOLD_DAYS = numberSetting(
  process.env.COMPANY_DASHBOARD_WAITING_APPROVAL_DAYS,
  7,
);

export type DashboardEmployee = {
  id: string;
  name: string;
  role: string;
  color: string;
};

export type DashboardJob = {
  id: string;
  customer_name: string;
  status: string;
  salesperson: string | null;
  assigned_employee_id: string | null;
  next_action: string | null;
  next_action_due: string | null;
  qfloors_job_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string | null;
  customer: { id: string; full_name: string } | null;
};

export type DashboardTask = {
  id: string;
  title: string;
  assigned_employee_id: string | null;
  assigned_to: string | null;
  due_at: string | null;
  due_date: string | null;
  completed: boolean;
  status: string;
  created_at: string;
};

export type DashboardAppointment = {
  id: string;
  job_id: string | null;
  appointment_type: AppointmentType;
  status: string;
  starts_at: string;
  assigned_employee_id: string | null;
  job: {
    id: string;
    customer_name: string;
    customer: { id: string; full_name: string } | null;
  } | null;
};

export type DashboardActivity = {
  id: string;
  job_id: string;
  activity_type: string;
  description: string;
  created_at: string;
};

export type AccountabilityRow = DashboardEmployee & {
  openTasks: number;
  overdueTasks: number;
  activeJobs: number;
  measuresToday: number;
  lastActivity: string | null;
  health: "green" | "yellow" | "red";
};

export type AttentionItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  href: string;
  severity: "yellow" | "red";
};

export type RecentActivityItem = {
  id: string;
  description: string;
  employeeName: string;
  createdAt: string;
  href: string;
  kind: string;
};

export type SalesPerformanceRow = {
  employee: DashboardEmployee;
  newLeads: number;
  estimatesSent: number;
  approvedJobs: number;
  completedJobs: number;
};

export type CompanyDashboardData = {
  employees: DashboardEmployee[];
  jobs: DashboardJob[];
  stages: PipelineStageConfig[];
  pipeline: Record<string, DashboardJob[]>;
  accountability: AccountabilityRow[];
  attentionItems: AttentionItem[];
  managementItems: AttentionItem[];
  recentActivity: RecentActivityItem[];
  workload: Array<{
    employee: DashboardEmployee;
    activeJobs: number;
    openTasks: number;
    total: number;
  }>;
  salesPerformance: SalesPerformanceRow[];
  snapshot: {
    todayLeads: number;
    measuresToday: number;
    installsToday: number;
    overdueTasks: number;
    waitingApproval: number;
  };
  thresholds: {
    followUpDays: number;
    waitingApprovalDays: number;
  };
};

export async function getCompanyDashboardData(): Promise<CompanyDashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const todayKey = dateKey(now);

  const [employeesResult, jobsResult, tasksResult, appointmentsResult, activitiesResult, stages] =
    await Promise.all([
      supabase
        .from("employees")
        .select("id, name, role, color")
        .eq("active", true)
        .order("name"),
      supabase
        .from("jobs")
        .select("id, customer_name, status, salesperson, assigned_employee_id, next_action, next_action_due, qfloors_job_number, phone, email, address, created_at, updated_at, customer:customers!jobs_customer_id_fkey(id, full_name)")
        .is("archived_at", null)
        .order("updated_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("job_tasks")
        .select("id, title, assigned_employee_id, assigned_to, due_at, due_date, completed, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("id, job_id, appointment_type, status, starts_at, assigned_employee_id, job:jobs!appointments_job_id_fkey(id, customer_name, customer:customers!jobs_customer_id_fkey(id, full_name))")
        .gte("starts_at", addDays(todayStart, -30).toISOString())
        .order("starts_at"),
      supabase
        .from("job_activities")
        .select("id, job_id, activity_type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(40),
      getPipelineStages(),
    ]);

  const error =
    employeesResult.error ??
    jobsResult.error ??
    tasksResult.error ??
    appointmentsResult.error ??
    activitiesResult.error;
  if (error) throw new Error(error.message);

  const employees = (employeesResult.data ?? []) as DashboardEmployee[];
  const jobs = (jobsResult.data ?? []).map((job) => ({
    ...job,
    customer: Array.isArray(job.customer) ? job.customer[0] ?? null : job.customer,
  })) as DashboardJob[];
  const tasks = (tasksResult.data ?? []) as DashboardTask[];
  const appointments = (appointmentsResult.data ?? []).map((appointment) => ({
    ...appointment,
    job: normalizeAppointmentJob(
      Array.isArray(appointment.job) ? appointment.job[0] ?? null : appointment.job,
    ),
  })) as DashboardAppointment[];
  const activities = (activitiesResult.data ?? []) as DashboardActivity[];

  const stageFor = (status: string | null) => stages.find((stage) => stage.slug === status || stage.label === status) ?? stages.find((stage) => stage.slug === "new_lead");
  const activeJobs = jobs.filter((job) => !stageFor(job.status)?.terminal);
  const openTasks = tasks.filter((task) => !task.completed && !["completed", "cancelled"].includes(task.status));
  const overdueTasks = openTasks.filter((task) => isTaskOverdue(task, now, todayKey));
  const todayAppointments = appointments.filter((appointment) => {
    const start = new Date(appointment.starts_at);
    return start >= todayStart && start < tomorrowStart && appointment.status !== "cancelled";
  });

  const pipeline = Object.fromEntries(
    stages.map((stage) => [
      stage.slug,
      jobs.filter((job) => stageFor(job.status)?.slug === stage.slug),
    ]),
  ) as Record<string, DashboardJob[]>;

  const accountability = employees.map((employee) => {
    const employeeOpenTasks = openTasks.filter((task) => belongsToEmployee(task, employee));
    const employeeOverdueTasks = overdueTasks.filter((task) => belongsToEmployee(task, employee));
    const employeeJobs = activeJobs.filter((job) => jobBelongsToEmployee(job, employee));
    const employeeMeasures = todayAppointments.filter(
      (appointment) =>
        appointment.appointment_type === "measure" &&
        appointment.assigned_employee_id === employee.id,
    );
    const lastActivity = latestDate([
      ...employeeJobs.map((job) => job.updated_at ?? job.created_at),
      ...tasks
        .filter((task) => belongsToEmployee(task, employee))
        .map((task) => task.created_at),
      ...appointments
        .filter((appointment) => appointment.assigned_employee_id === employee.id)
        .map((appointment) => appointment.starts_at),
    ]);

    return {
      ...employee,
      openTasks: employeeOpenTasks.length,
      overdueTasks: employeeOverdueTasks.length,
      activeJobs: employeeJobs.length,
      measuresToday: employeeMeasures.length,
      lastActivity,
      health: healthFor(employeeOverdueTasks.length, employeeOpenTasks.length),
    } satisfies AccountabilityRow;
  });

  const attentionItems = buildAttentionItems({ jobs, overdueTasks, appointments, now, todayStart, stages });
  const managementItems = [
    ...attentionItems.filter((item) => ["missing_qf", "unassigned_appointment", "missing_information"].includes(item.kind)),
    ...accountability
      .filter((row) => row.overdueTasks > 0)
      .map((row) => ({
        id: `employee-${row.id}`,
        kind: "employee_overdue",
        title: `${row.name} has overdue work`,
        detail: `${row.overdueTasks} overdue ${row.overdueTasks === 1 ? "task" : "tasks"}`,
        href: `/my-dashboard?employee=${row.id}`,
        severity: row.overdueTasks >= 3 ? "red" : "yellow",
      }) satisfies AttentionItem),
  ].slice(0, 12);

  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const recentActivity = activities.map((activity) => {
    const job = jobsById.get(activity.job_id);
    const employeeName = job?.salesperson ?? "System";
    return {
      id: activity.id,
      description: activity.description,
      employeeName,
      createdAt: activity.created_at,
      href: `/leads/${activity.job_id}`,
      kind: activity.activity_type,
    };
  });

  const workload = accountability
    .map((row) => ({
      employee: { id: row.id, name: row.name, role: row.role, color: row.color },
      activeJobs: row.activeJobs,
      openTasks: row.openTasks,
      total: row.activeJobs + row.openTasks,
    }))
    .sort((a, b) => b.total - a.total);

  const salesPerformance = employees.map((employee) => ({
    employee,
    newLeads: jobs.filter((job) => jobBelongsToEmployee(job, employee) && stageFor(job.status)?.slug === "new_lead").length,
    estimatesSent: jobs.filter((job) => jobBelongsToEmployee(job, employee) && stageFor(job.status)?.slug === "estimate_sent").length,
    approvedJobs: jobs.filter((job) => jobBelongsToEmployee(job, employee) && stageFor(job.status)?.slug === "approved").length,
    completedJobs: jobs.filter((job) => jobBelongsToEmployee(job, employee) && stageFor(job.status)?.slug === "complete").length,
  }));

  return {
    employees,
    jobs,
    stages,
    pipeline,
    accountability,
    attentionItems,
    managementItems,
    recentActivity,
    workload,
    salesPerformance,
    snapshot: {
      todayLeads: jobs.filter((job) => new Date(job.created_at) >= todayStart).length,
      measuresToday: todayAppointments.filter((appointment) => appointment.appointment_type === "measure").length,
      installsToday: todayAppointments.filter((appointment) => appointment.appointment_type === "installation").length,
      overdueTasks: overdueTasks.length,
      waitingApproval: pipeline.waiting_approval?.length ?? 0,
    },
    thresholds: {
      followUpDays: FOLLOW_UP_THRESHOLD_DAYS,
      waitingApprovalDays: WAITING_APPROVAL_THRESHOLD_DAYS,
    },
  };
}

function buildAttentionItems({
  jobs,
  overdueTasks,
  appointments,
  now,
  todayStart,
  stages,
}: {
  jobs: DashboardJob[];
  overdueTasks: DashboardTask[];
  appointments: DashboardAppointment[];
  now: Date;
  todayStart: Date;
  stages: PipelineStageConfig[];
}) {
  const items: AttentionItem[] = [];
  const followUpCutoff = addDays(now, -FOLLOW_UP_THRESHOLD_DAYS);
  const approvalCutoff = addDays(now, -WAITING_APPROVAL_THRESHOLD_DAYS);

  for (const job of jobs) {
    const stage = stages.find((item) => item.slug === job.status || item.label === job.status) ?? stages.find((item) => item.slug === "new_lead");
    const updated = new Date(job.updated_at ?? job.created_at);
    if (!stage?.terminal && updated < followUpCutoff && !job.next_action_due) {
      items.push({ id: `followup-${job.id}`, kind: "stale_followup", title: "No recent follow-up", detail: job.customer_name, href: `/leads/${job.id}`, severity: "yellow" });
    }
    if (stage?.qf_number_required && !job.qfloors_job_number) {
      items.push({ id: `qf-${job.id}`, kind: "missing_qf", title: "Missing QF#", detail: job.customer_name, href: `/leads/${job.id}`, severity: "red" });
    }
    if (stage?.slug === "floor_measure" && job.next_action_due && job.next_action_due < dateKey(todayStart)) {
      items.push({ id: `measure-${job.id}`, kind: "overdue_measure", title: "Overdue floor measure", detail: job.customer_name, href: `/leads/${job.id}`, severity: "red" });
    }
    if (stage?.slug === "waiting_approval" && updated < approvalCutoff) {
      items.push({ id: `approval-${job.id}`, kind: "waiting_approval", title: "Waiting approval too long", detail: job.customer_name, href: `/leads/${job.id}`, severity: "yellow" });
    }
    if (stage?.slug === "approved") {
      items.push({ id: `materials-${job.id}`, kind: "materials_not_ordered", title: "Materials not ordered", detail: job.customer_name, href: `/leads/${job.id}`, severity: "yellow" });
    }
    if (!job.customer?.id || !job.customer_name.trim() || (!job.phone && !job.email)) {
      items.push({ id: `info-${job.id}`, kind: "missing_information", title: "Missing required job/customer information", detail: job.customer_name || "Untitled job", href: `/leads/${job.id}`, severity: "yellow" });
    }
  }

  for (const task of overdueTasks) {
    items.push({ id: `task-${task.id}`, kind: "overdue_task", title: "Overdue task", detail: task.title, href: `/tasks?task=${task.id}`, severity: "red" });
  }

  for (const appointment of appointments.filter((item) => new Date(item.starts_at) >= todayStart && item.status !== "cancelled" && !item.assigned_employee_id)) {
    items.push({ id: `appointment-${appointment.id}`, kind: "unassigned_appointment", title: "Unassigned appointment", detail: formatAppointmentDisplayName({ appointmentType: appointment.appointment_type, customerName: appointment.job?.customer?.full_name, jobName: appointment.job?.customer_name }), href: `/calendar?appointment=${appointment.id}&date=${dateKey(new Date(appointment.starts_at))}`, severity: "red" });
  }

  return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "red" ? -1 : 1)).slice(0, 30);
}

function normalizeAppointmentJob<T extends { customer?: unknown }>(job: T | null) {
  if (!job) return null;
  return {
    ...job,
    customer: Array.isArray(job.customer) ? job.customer[0] ?? null : job.customer ?? null,
  };
}

function belongsToEmployee(task: DashboardTask, employee: DashboardEmployee) {
  return task.assigned_employee_id === employee.id || task.assigned_to === employee.name;
}

function jobBelongsToEmployee(job: DashboardJob, employee: DashboardEmployee) {
  return job.assigned_employee_id === employee.id || job.salesperson === employee.name;
}

function isTaskOverdue(task: DashboardTask, now: Date, todayKey: string) {
  if (task.due_at) return new Date(task.due_at) < now;
  return Boolean(task.due_date && task.due_date < todayKey);
}

function healthFor(overdue: number, open: number): AccountabilityRow["health"] {
  if (overdue >= 3) return "red";
  if (overdue > 0 || open >= 12) return "yellow";
  return "green";
}

function latestDate(values: string[]) {
  if (!values.length) return null;
  return values.reduce((latest, value) => (new Date(value) > new Date(latest) ? value : latest));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function numberSetting(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}
