import "server-only";

import { getPipelineStages, type PipelineStageConfig } from "@/lib/services/pipeline-stages";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentType } from "@/components/calendar/constants";
import { formatAppointmentDisplayName } from "@/lib/appointment-display";
import {
  severityRank,
  type DashboardRuleSeverity,
} from "@/lib/dashboard-rules";
import {
  enabledRuleMap,
  getCompanyDashboardRuleSettings,
  type DashboardRuleSetting,
} from "@/lib/services/dashboard-rule-settings";
import type { Employee } from "@/lib/services/employees";

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
  contract_amount: string | null;
  company_contact_id: string | null;
  job_site_contact_id: string | null;
  installation_required: boolean;
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
  severity: DashboardRuleSeverity;
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
    noActivityDays: number;
  };
};

export async function getCompanyDashboardData(
  currentEmployee: Pick<Employee, "id" | "name">,
): Promise<CompanyDashboardData> {
  const supabase = await createClient();
  const ruleSettings = await getCompanyDashboardRuleSettings();
  const enabledRules = enabledRuleMap(ruleSettings);
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
        .select("id, customer_name, status, salesperson, assigned_employee_id, next_action, next_action_due, qfloors_job_number, phone, email, address, contract_amount, company_contact_id, job_site_contact_id, installation_required, created_at, updated_at, customer:customers!jobs_customer_id_fkey(id, full_name)")
        .is("archived_at", null)
        .order("updated_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("job_tasks")
        .select("id, title, assigned_employee_id, assigned_to, due_at, due_date, completed, status, created_at")
        .or(`automation_rule_id.is.null,due_at.is.null,due_at.lte.${now.toISOString()}`)
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

  const [layoutsByJob, attachmentsByJob, unreadMentions] = await Promise.all([
    enabledRules.has("missing_layout")
      ? loadJobPresence(supabase, "job_layouts")
      : Promise.resolve(new Set<string>()),
    enabledRules.has("missing_photos") || enabledRules.has("missing_files")
      ? loadAttachmentPresence(supabase)
      : Promise.resolve({ photos: new Set<string>(), files: new Set<string>() }),
    enabledRules.has("mentions_for_me")
      ? loadUnreadMentions(supabase, currentEmployee.id)
      : Promise.resolve([]),
  ]);

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

  const attentionItems = buildAttentionItems({
    jobs,
    overdueTasks,
    appointments,
    now,
    todayStart,
    stages,
    enabledRules,
    layoutsByJob,
    attachmentsByJob,
  });
  const managementItems = buildPersonalAttentionItems({
    currentEmployee,
    jobs: activeJobs,
    openTasks,
    overdueTasks,
    unreadMentions,
    stages,
    enabledRules,
  });

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
      noActivityDays: Number(
        enabledRules.get("no_recent_activity")?.configuration.days ?? 14,
      ),
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
  enabledRules,
  layoutsByJob,
  attachmentsByJob,
}: {
  jobs: DashboardJob[];
  overdueTasks: DashboardTask[];
  appointments: DashboardAppointment[];
  now: Date;
  todayStart: Date;
  stages: PipelineStageConfig[];
  enabledRules: Map<string, DashboardRuleSetting>;
  layoutsByJob: Set<string>;
  attachmentsByJob: { photos: Set<string>; files: Set<string> };
}) {
  const items: AttentionItem[] = [];
  const noActivityRule = enabledRules.get("no_recent_activity");
  const noActivityDays = noActivityRule
    ? Number(noActivityRule.configuration.days ?? 14)
    : 14;
  const activityCutoff = addDays(now, -noActivityDays);

  for (const job of jobs) {
    const stage = stages.find((item) => item.slug === job.status || item.label === job.status) ?? stages.find((item) => item.slug === "new_lead");
    const updated = new Date(job.updated_at ?? job.created_at);
    if (stage?.terminal) continue;

    addJobRuleItem(items, enabledRules, "missing_qf_number",
      Boolean(stage?.qf_number_required && !job.qfloors_job_number),
      job, "Missing QF#");
    addJobRuleItem(items, enabledRules, "missing_contract_amount",
      Boolean(stage?.contract_amount_required && !job.contract_amount),
      job, "Missing Contract Amount");
    addJobRuleItem(items, enabledRules, "missing_company_contact",
      !job.company_contact_id, job, "Missing Company Contact");
    addJobRuleItem(items, enabledRules, "missing_job_site_contact",
      !job.job_site_contact_id, job, "Missing Job Site Contact");
    addJobRuleItem(items, enabledRules, "missing_job_address",
      !job.address?.trim(), job, "Missing Job Address");
    addJobRuleItem(items, enabledRules, "missing_layout",
      !layoutsByJob.has(job.id), job, "Missing Layout");
    addJobRuleItem(items, enabledRules, "missing_photos",
      !attachmentsByJob.photos.has(job.id), job, "Missing Photos");
    addJobRuleItem(items, enabledRules, "missing_files",
      !attachmentsByJob.files.has(job.id), job, "Missing Files");
    addJobRuleItem(items, enabledRules, "no_recent_activity",
      updated < activityCutoff, job, `No Activity in ${noActivityDays} Days`);

    const hasInstall = appointments.some(
      (appointment) =>
        appointment.job_id === job.id &&
        appointment.appointment_type === "installation" &&
        appointment.status !== "cancelled",
    );
    addJobRuleItem(items, enabledRules, "missing_install_date",
      Boolean(
        job.installation_required &&
        stage?.slug === "install_scheduled" &&
        !hasInstall
      ),
      job, "Install Scheduled without Install Date");
  }

  const overdueTaskRule = enabledRules.get("overdue_tasks");
  if (overdueTaskRule) {
    for (const task of overdueTasks) {
      items.push({
        id: `task-${task.id}`,
        kind: overdueTaskRule.ruleKey,
        title: "Overdue Task",
        detail: task.title,
        href: `/tasks?task=${task.id}`,
        severity: overdueTaskRule.severity,
      });
    }
  }

  const appointmentRule = enabledRules.get("unassigned_appointments");
  if (appointmentRule) {
    for (const appointment of appointments.filter((item) => new Date(item.starts_at) >= todayStart && item.status !== "cancelled" && !item.assigned_employee_id)) {
      items.push({
        id: `appointment-${appointment.id}`,
        kind: appointmentRule.ruleKey,
        title: "Unassigned Appointment",
        detail: formatAppointmentDisplayName({
          appointmentType: appointment.appointment_type,
          customerName: appointment.job?.customer?.full_name,
          jobName: appointment.job?.customer_name,
        }),
        href: `/calendar?appointment=${appointment.id}&date=${dateKey(new Date(appointment.starts_at))}`,
        severity: appointmentRule.severity,
      });
    }
  }

  return sortAttentionItems(items).slice(0, 30);
}

function buildPersonalAttentionItems({
  currentEmployee,
  jobs,
  openTasks,
  overdueTasks,
  unreadMentions,
  stages,
  enabledRules,
}: {
  currentEmployee: Pick<Employee, "id" | "name">;
  jobs: DashboardJob[];
  openTasks: DashboardTask[];
  overdueTasks: DashboardTask[];
  unreadMentions: Array<{ message_id: string; created_at: string }>;
  stages: PipelineStageConfig[];
  enabledRules: Map<string, DashboardRuleSetting>;
}) {
  const items: AttentionItem[] = [];
  const employeeJobs = jobs.filter((job) => jobBelongsToEmployee(job, {
    ...currentEmployee,
    role: "",
    color: "",
  }));
  const employeeTasks = openTasks.filter((task) =>
    task.assigned_employee_id === currentEmployee.id ||
    task.assigned_to === currentEmployee.name
  );

  const assignedJobsRule = enabledRules.get("jobs_assigned_to_me");
  if (assignedJobsRule) {
    for (const job of employeeJobs) {
      items.push(jobAttentionItem(job, assignedJobsRule, "Job Assigned to Me"));
    }
  }

  const assignedTasksRule = enabledRules.get("tasks_assigned_to_me");
  if (assignedTasksRule) {
    for (const task of employeeTasks) {
      items.push({
        id: `mine-task-${task.id}`,
        kind: assignedTasksRule.ruleKey,
        title: "Task Assigned to Me",
        detail: task.title,
        href: `/tasks?task=${task.id}`,
        severity: assignedTasksRule.severity,
      });
    }
  }

  const approvalRule = enabledRules.get("jobs_awaiting_my_approval");
  if (approvalRule) {
    for (const job of employeeJobs.filter((job) => {
      const stage = stages.find((item) => item.slug === job.status || item.label === job.status);
      return stage?.slug === "waiting_approval";
    })) {
      items.push(jobAttentionItem(job, approvalRule, "Job Awaiting My Approval"));
    }
  }

  const overdueRule = enabledRules.get("overdue_items_assigned_to_me");
  if (overdueRule) {
    for (const task of overdueTasks.filter((item) =>
      item.assigned_employee_id === currentEmployee.id ||
      item.assigned_to === currentEmployee.name
    )) {
      items.push({
        id: `mine-overdue-${task.id}`,
        kind: overdueRule.ruleKey,
        title: "My Overdue Task",
        detail: task.title,
        href: `/tasks?task=${task.id}`,
        severity: overdueRule.severity,
      });
    }
  }

  const mentionRule = enabledRules.get("mentions_for_me");
  if (mentionRule && unreadMentions.length) {
    items.push({
      id: "my-unread-mentions",
      kind: mentionRule.ruleKey,
      title: "Unread Mentions",
      detail: `${unreadMentions.length} unread ${unreadMentions.length === 1 ? "mention" : "mentions"}`,
      href: "/my-dashboard",
      severity: mentionRule.severity,
    });
  }

  return sortAttentionItems(items).slice(0, 20);
}

function addJobRuleItem(
  items: AttentionItem[],
  enabledRules: Map<string, DashboardRuleSetting>,
  ruleKey: string,
  matches: boolean,
  job: DashboardJob,
  title: string,
) {
  const rule = enabledRules.get(ruleKey);
  if (rule && matches) items.push(jobAttentionItem(job, rule, title));
}

function jobAttentionItem(
  job: DashboardJob,
  rule: DashboardRuleSetting,
  title: string,
): AttentionItem {
  return {
    id: `${rule.ruleKey}-${job.id}`,
    kind: rule.ruleKey,
    title,
    detail: job.customer_name || "Untitled job",
    href: `/leads/${job.id}`,
    severity: rule.severity,
  };
}

function sortAttentionItems(items: AttentionItem[]) {
  return items.sort(
    (first, second) =>
      severityRank(first.severity) - severityRank(second.severity) ||
      first.title.localeCompare(second.title),
  );
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function loadJobPresence(
  supabase: ServerSupabaseClient,
  table: "job_layouts",
) {
  const { data, error } = await supabase
    .from(table)
    .select("job_id")
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.job_id as string));
}

async function loadAttachmentPresence(supabase: ServerSupabaseClient) {
  const { data, error } = await supabase
    .from("job_attachments")
    .select("job_id, attachment_kind")
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  const photos = new Set<string>();
  const files = new Set<string>();
  for (const row of data ?? []) {
    if (row.attachment_kind === "photo") photos.add(row.job_id);
    if (row.attachment_kind === "file") files.add(row.job_id);
  }
  return { photos, files };
}

async function loadUnreadMentions(
  supabase: ServerSupabaseClient,
  employeeId: string,
) {
  const { data, error } = await supabase
    .from("message_mentions")
    .select("message_id, created_at")
    .eq("employee_id", employeeId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ message_id: string; created_at: string }>;
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
