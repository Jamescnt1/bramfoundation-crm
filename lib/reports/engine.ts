import "server-only";

import { getReportDefinition } from "@/lib/reports/definitions";
import { parseReportDateRange } from "@/lib/reports/date-range";
import type {
  ReportChartItem,
  ReportFilters,
  ReportResult,
} from "@/lib/reports/types";
import { requirePermission } from "@/lib/services/employees";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COMPANY_TIME_ZONE } from "@/lib/date-time";

type Relation<T> = T | T[] | null;
type EmployeeRelation = { id: string; name: string } | null;
type CustomerRelation = { id: string; full_name: string } | null;

type JobRow = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  status: string;
  salesperson: string | null;
  assigned_employee_id: string | null;
  lead_source: string | null;
  contract_amount: string | number | null;
  billed_at: string | null;
  qfloors_job_number: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
  customer: Relation<{ id: string; full_name: string }>;
};

type StageRow = {
  slug: string;
  label: string;
  color_key: string;
  sort_order: number;
  active: boolean;
  terminal: boolean;
  contract_amount_required: boolean;
};

type JobStageTransitionRow = {
  id: string;
  job_id: string;
  from_stage: string | null;
  to_stage: string;
  entered_at: string;
  contract_amount: string | number | null;
  source: string;
  job: Relation<JobRow>;
};

type TaskRow = {
  id: string;
  assigned_employee_id: string | null;
  status: string;
  completed: boolean;
  completed_at: string | null;
  due_at: string | null;
  due_date: string | null;
  created_at: string;
  employee: { id: string; name: string } | null;
  task_type: { name: string } | null;
};

type AppointmentRow = {
  id: string;
  job_id: string | null;
  assigned_employee_id: string | null;
  appointment_type: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  employee: { id: string; name: string } | null;
};

const RESULT_LIMIT = 5000;

export async function runReport(reportId: string, filters: ReportFilters): Promise<ReportResult> {
  await requirePermission("reports.view");
  const definition = getReportDefinition(reportId);
  if (!definition) throw new Error("Report not found.");
  const settingsClient = await createClient();
  const { data: settings, error: settingsError } = await settingsClient
    .from("company_settings")
    .select("timezone")
    .eq("singleton_key", true)
    .maybeSingle();
  if (settingsError) throw new Error(settingsError.message);
  const range = parseReportDateRange(
    filters.from,
    filters.to,
    settings?.timezone || DEFAULT_COMPANY_TIME_ZONE,
  );

  switch (reportId) {
    case "executive-overview":
      return buildExecutiveReport(filters, range);
    case "sales-performance":
      return buildSalesReport(filters, range);
    case "operations-health":
      return buildOperationsReport(filters, range);
    case "employee-scorecards":
      return buildEmployeeReport(filters, range);
    case "customer-value":
      return buildCustomerReport(filters, range);
    case "pipeline-funnel":
      return buildPipelineReport(filters, range, false);
    case "pipeline-velocity":
      return buildPipelineReport(filters, range, true);
    case "task-performance":
      return buildTaskReport(filters, range);
    case "calendar-performance":
      return buildCalendarReport(filters, range);
    case "operational-dollars":
      return buildOperationalDollarsReport(filters, range);
    case "file-coverage":
      return buildFilesReport(filters, range);
    case "communications-overview":
      return buildCommunicationsReport(filters, range);
    default:
      throw new Error("Report not found.");
  }
}

type ParsedRange = ReturnType<typeof parseReportDateRange>;

async function getPipelineContext() {
  const supabase = await createClient();
  const [stagesResult, aliasesResult] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("slug, label, color_key, sort_order, active, terminal, contract_amount_required")
      .eq("active", true)
      .order("sort_order"),
    supabase.from("pipeline_stage_aliases").select("alias, stage_slug"),
  ]);
  if (stagesResult.error) throw new Error(stagesResult.error.message);
  if (aliasesResult.error) throw new Error(aliasesResult.error.message);
  const stages = (stagesResult.data ?? []) as StageRow[];
  const stageBySlug = new Map(stages.map((stage) => [stage.slug, stage]));
  const aliasMap = new Map(
    (aliasesResult.data ?? []).map((item) => [item.alias.toLowerCase(), item.stage_slug]),
  );
  return { stages, stageBySlug, aliasMap };
}

async function getJobs(filters: ReportFilters, range: ParsedRange, dateColumn: "created_at" | "updated_at" = "created_at") {
  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select(`
      id, customer_id, customer_name, status, salesperson, assigned_employee_id,
      lead_source, contract_amount, billed_at, qfloors_job_number, address,
      created_at, updated_at,
      customer:customers!jobs_customer_id_fkey(id, full_name)
    `)
    .is("archived_at", null)
    .gte(dateColumn, range.fromIso)
    .lte(dateColumn, range.toIso)
    .order(dateColumn, { ascending: false })
    .limit(RESULT_LIMIT);
  if (filters.employeeId) query = query.eq("assigned_employee_id", filters.employeeId);
  if (filters.salesperson) query = query.eq("salesperson", filters.salesperson);
  if (filters.pipelineStage) {
    const [stageResult, aliasesResult] = await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("slug, label")
        .eq("slug", filters.pipelineStage)
        .maybeSingle(),
      supabase
        .from("pipeline_stage_aliases")
        .select("alias")
        .eq("stage_slug", filters.pipelineStage),
    ]);
    if (stageResult.error) throw new Error(stageResult.error.message);
    if (aliasesResult.error) throw new Error(aliasesResult.error.message);
    const statuses = [...new Set([
      filters.pipelineStage,
      stageResult.data?.label,
      ...(aliasesResult.data ?? []).map((item) => item.alias),
    ].filter((value): value is string => Boolean(value)))];
    query = query.in("status", statuses);
  }
  if (filters.leadSource) query = query.eq("lead_source", filters.leadSource);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((job) => ({
    ...job,
    customer: first(job.customer),
  })) as JobRow[];
}

function resolveStage(job: JobRow, context: Awaited<ReturnType<typeof getPipelineContext>>) {
  return resolveStageStatus(job.status, context);
}

function resolveStageStatus(status: string, context: Awaited<ReturnType<typeof getPipelineContext>>) {
  const direct = context.stageBySlug.get(status);
  if (direct) return direct;
  const alias = context.aliasMap.get(status.toLowerCase());
  if (alias) return context.stageBySlug.get(alias);
  return context.stages.find((stage) => stage.label.toLowerCase() === status.toLowerCase());
}

async function getJobStageTransitions(filters: ReportFilters, range: ParsedRange) {
  const supabase = await createClient();
  let query = supabase
    .from("job_stage_transitions")
    .select(`
      id, job_id, from_stage, to_stage, entered_at, contract_amount, source,
      job:jobs!job_stage_transitions_job_id_fkey!inner(
        id, customer_id, customer_name, status, salesperson, assigned_employee_id,
        lead_source, contract_amount, billed_at, qfloors_job_number, address,
        created_at, updated_at, archived_at,
        customer:customers!jobs_customer_id_fkey(id, full_name)
      )
    `)
    .is("job.archived_at", null)
    .gte("entered_at", range.fromIso)
    .lte("entered_at", range.toIso)
    .order("entered_at", { ascending: true })
    .limit(RESULT_LIMIT);
  if (filters.salesperson) query = query.eq("job.salesperson", filters.salesperson);
  if (filters.leadSource) query = query.eq("job.lead_source", filters.leadSource);
  if (filters.customerId) query = query.eq("job.customer_id", filters.customerId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as JobStageTransitionRow[]).map((transition) => ({
    ...transition,
    job: first(transition.job),
  })).filter((transition): transition is JobStageTransitionRow & { job: JobRow } => Boolean(transition.job));
}

async function buildExecutiveReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const [jobs, context] = await Promise.all([getJobs(filters, range), getPipelineContext()]);
  const approvedOrder = context.stageBySlug.get("approved")?.sort_order ?? 4;
  const won = jobs.filter((job) => {
    const stage = resolveStage(job, context);
    return stage && stage.sort_order >= approvedOrder && stage.slug !== "lost";
  });
  const completed = won.filter((job) => resolveStage(job, context)?.slug === "complete");
  const lost = jobs.filter((job) => resolveStage(job, context)?.slug === "lost");
  const pipeline = jobs.filter((job) => {
    const stage = resolveStage(job, context);
    return stage && !stage.terminal && stage.slug !== "lost";
  });
  const sourceGroups = groupBy(jobs, (job) => job.lead_source || "Unspecified");
  const rows = [...sourceGroups.entries()]
    .map(([source, sourceJobs]) => ({
      source,
      jobs: sourceJobs.length,
      soldJobs: sourceJobs.filter((job) => won.includes(job)).length,
      soldDollars: sum(sourceJobs.filter((job) => won.includes(job)).map(amount)),
    }))
    .sort((a, b) => b.soldDollars - a.soldDollars);

  return {
    id: "executive-overview",
    title: "Executive Overview",
    description: "Operational sales and pipeline performance for jobs created in the selected period.",
    rangeLabel: range.label,
    metrics: [
      metric("Sales this period", currency(sum(won.map(amount))), `${won.length} sold jobs`, "positive"),
      metric("Pipeline value", currency(sum(pipeline.map(amount))), `${pipeline.length} active jobs`),
      metric("Completed revenue", currency(sum(completed.map(amount))), `${completed.length} completed jobs`),
      metric("Average job size", currency(average(won.map(amount))), "Sold jobs"),
      metric("Win rate", percent(rate(won.length, won.length + lost.length)), "Won ÷ won and lost"),
    ],
    columns: [
      { key: "source", label: "Lead source" },
      { key: "jobs", label: "Jobs", align: "right" },
      { key: "soldJobs", label: "Sold", align: "right" },
      { key: "soldDollarsFormatted", label: "Sold dollars", align: "right" },
    ],
    rows: rows.map((row) => ({ ...row, soldDollarsFormatted: currency(row.soldDollars) })),
    chart: chart("Revenue by lead source", rows.map((row) => ({ label: row.source, value: row.soldDollars, formattedValue: currency(row.soldDollars) }))),
    notes: dataLimitNote(jobs.length),
  };
}

async function buildSalesReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const [jobs, appointments, context] = await Promise.all([
    getJobs(filters, range),
    getAppointments(filters, range),
    getPipelineContext(),
  ]);
  const approvedOrder = context.stageBySlug.get("approved")?.sort_order ?? 4;
  const sold = jobs.filter((job) => {
    const stage = resolveStage(job, context);
    return stage && stage.sort_order >= approvedOrder && stage.slug !== "lost";
  });
  const lost = jobs.filter((job) => resolveStage(job, context)?.slug === "lost");
  const measures = appointments.filter((appointment) => appointment.appointment_type === "measure" && appointmentHasOccurred(appointment));
  const estimates = jobs.filter((job) => {
    const stage = resolveStage(job, context);
    return stage?.slug.includes("estimate") || stage?.label.toLowerCase().includes("estimate");
  });
  const employeeGroups = groupBy(jobs, (job) => job.salesperson || "Unassigned");
  const rows = [...employeeGroups.entries()].map(([employee, employeeJobs]) => {
    const employeeSold = employeeJobs.filter((job) => sold.includes(job));
    const employeeLost = employeeJobs.filter((job) => lost.includes(job));
    return {
      employee,
      leads: employeeJobs.length,
      sold: employeeSold.length,
      closeRate: percent(rate(employeeSold.length, employeeSold.length + employeeLost.length)),
      soldDollars: currency(sum(employeeSold.map(amount))),
    };
  }).sort((a, b) => moneyNumber(b.soldDollars) - moneyNumber(a.soldDollars));

  return {
    id: "sales-performance",
    title: "Sales Performance",
    description: "Sales activity tied to jobs and appointments in the selected period.",
    rangeLabel: range.label,
    metrics: [
      metric("Leads created", number(jobs.length)),
      metric("Measures occurred", number(measures.length)),
      metric("Estimates currently sent", number(estimates.length)),
      metric("Close percentage", percent(rate(sold.length, sold.length + lost.length))),
      metric("Sold dollars", currency(sum(sold.map(amount))), `${sold.length} jobs`, "positive"),
    ],
    columns: [
      { key: "employee", label: "Salesperson" },
      { key: "leads", label: "Leads", align: "right" },
      { key: "sold", label: "Sold", align: "right" },
      { key: "closeRate", label: "Close rate", align: "right" },
      { key: "soldDollars", label: "Sold dollars", align: "right" },
    ],
    rows,
    chart: chart("Sales by employee", rows.map((row) => ({ label: row.employee, value: moneyNumber(row.soldDollars), formattedValue: row.soldDollars }))),
    notes: [
      "Average days to close requires a durable stage-transition ledger. Foundation does not yet store one reliably, so this report does not invent that number.",
      ...dataLimitNote(Math.max(jobs.length, appointments.length)),
    ],
  };
}

async function buildOperationsReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const [jobs, appointments, context] = await Promise.all([
    getJobs(filters, range, "updated_at"),
    getAppointments(filters, range),
    getPipelineContext(),
  ]);
  const installs = appointments.filter((item) => item.appointment_type === "installation");
  const scheduled = installs.filter((item) => item.status !== "cancelled");
  const occurred = installs.filter(appointmentHasOccurred);
  const materialScopes = await getMaterialScopes(jobs.map((job) => job.id));
  const waitingMaterialJobIds = new Set(
    materialScopes
      .filter((scope) =>
        scope.ordering_required && !["ready", "excluded"].includes(scope.material_status),
      )
      .map((scope) => scope.job_id),
  );
  const waitingMaterials = jobs.filter((job) => waitingMaterialJobIds.has(job.id));
  const stalledCutoff = Date.now() - 14 * 86_400_000;
  const stalled = jobs.filter((job) => new Date(job.updated_at).getTime() < stalledCutoff);
  const missingQf = jobs.filter((job) => {
    const stage = resolveStage(job, context);
    return Boolean(stage && stage.sort_order >= (context.stageBySlug.get("approved")?.sort_order ?? 4) && !job.qfloors_job_number);
  });
  const missingAmount = jobs.filter((job) => resolveStage(job, context)?.contract_amount_required && !amount(job));
  const rows = [
    { issue: "Jobs waiting materials", count: waitingMaterials.length, action: "Review material readiness" },
    { issue: "Jobs stalled 14+ days", count: stalled.length, action: "Review owner and next action" },
    { issue: "Missing QF#", count: missingQf.length, action: "Complete job information" },
    { issue: "Missing contract amount", count: missingAmount.length, action: "Complete approved job value" },
  ];
  return {
    id: "operations-health",
    title: "Operations Health",
    description: "Installation activity and operational exceptions updated in the selected period.",
    rangeLabel: range.label,
    metrics: [
      metric("Installs scheduled", number(scheduled.length)),
      metric("Installs occurred", number(occurred.length), "", "positive"),
      metric("Waiting materials", number(waitingMaterials.length)),
      metric("Stalled jobs", number(stalled.length), "No update for 14+ days", stalled.length ? "warning" : "default"),
    ],
    columns: [
      { key: "issue", label: "Attention area" },
      { key: "count", label: "Jobs", align: "right" },
      { key: "action", label: "Manager question" },
    ],
    rows,
    chart: chart("Operations attention", rows.map((row) => ({ label: row.issue, value: row.count }))),
    notes: dataLimitNote(Math.max(jobs.length, appointments.length)),
  };
}

async function getMaterialScopes(jobIds: string[]) {
  if (!jobIds.length) return [] as Array<{
    job_id: string;
    ordering_required: boolean;
    material_status: string;
  }>;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_material_scopes")
    .select("job_id, ordering_required, material_status")
    .in("job_id", jobIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function buildEmployeeReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const supabase = await createClient();
  const [employeesResult, jobs, tasks, appointments, context] = await Promise.all([
    supabase.from("employees").select("id, name").eq("active", true).order("name"),
    getJobs({ ...filters, employeeId: undefined }, range),
    getTasks(filters, range),
    getAppointments(filters, range),
    getPipelineContext(),
  ]);
  if (employeesResult.error) throw new Error(employeesResult.error.message);
  const approvedOrder = context.stageBySlug.get("approved")?.sort_order ?? 4;
  const employees = (employeesResult.data ?? []).filter((employee) => !filters.employeeId || employee.id === filters.employeeId);
  const rows = employees.map((employee) => {
    const employeeJobs = jobs.filter((job) => job.assigned_employee_id === employee.id || job.salesperson?.toLowerCase() === employee.name.toLowerCase());
    const sold = employeeJobs.filter((job) => {
      const stage = resolveStage(job, context);
      return stage && stage.sort_order >= approvedOrder && stage.slug !== "lost";
    });
    const lost = employeeJobs.filter((job) => resolveStage(job, context)?.slug === "lost");
    const employeeTasks = tasks.filter((task) => task.assigned_employee_id === employee.id);
    const doneTasks = employeeTasks.filter((task) => task.completed || task.status === "completed");
    const overdue = employeeTasks.filter(isTaskOverdue);
    const employeeAppointments = appointments.filter((appointment) => appointment.assigned_employee_id === employee.id);
    return {
      employee: employee.name,
      leads: employeeJobs.length,
      measures: employeeAppointments.filter((item) => item.appointment_type === "measure").length,
      sold: sold.length,
      closeRate: percent(rate(sold.length, sold.length + lost.length)),
      soldDollars: currency(sum(sold.map(amount))),
      openTasks: employeeTasks.length - doneTasks.length,
      overdueTasks: overdue.length,
      taskCompletion: percent(rate(doneTasks.length, employeeTasks.length)),
      occurredAppointments: employeeAppointments.filter(appointmentHasOccurred).length,
    };
  });
  return {
    id: "employee-scorecards",
    title: "Employee Scorecards",
    description: "Cross-functional workload and outcomes for active employees.",
    rangeLabel: range.label,
    metrics: [
      metric("Active employees", number(rows.length)),
      metric("Sold dollars", currency(sum(rows.map((row) => moneyNumber(row.soldDollars)))), "", "positive"),
      metric("Open tasks", number(sum(rows.map((row) => row.openTasks)))),
      metric("Overdue tasks", number(sum(rows.map((row) => row.overdueTasks))), "", sum(rows.map((row) => row.overdueTasks)) ? "warning" : "default"),
    ],
    columns: [
      { key: "employee", label: "Employee" },
      { key: "leads", label: "Leads", align: "right" },
      { key: "measures", label: "Measures", align: "right" },
      { key: "sold", label: "Sold", align: "right" },
      { key: "closeRate", label: "Close", align: "right" },
      { key: "soldDollars", label: "Sold dollars", align: "right" },
      { key: "openTasks", label: "Open tasks", align: "right" },
      { key: "overdueTasks", label: "Overdue", align: "right" },
      { key: "taskCompletion", label: "Task completion", align: "right" },
      { key: "occurredAppointments", label: "Occurred appts.", align: "right" },
    ],
    rows,
    chart: chart("Sold dollars by employee", rows.map((row) => ({ label: row.employee, value: moneyNumber(row.soldDollars), formattedValue: row.soldDollars }))),
  };
}

async function buildCustomerReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const [jobs, context] = await Promise.all([getJobs(filters, range), getPipelineContext()]);
  const approvedOrder = context.stageBySlug.get("approved")?.sort_order ?? 4;
  const sold = jobs.filter((job) => {
    const stage = resolveStage(job, context);
    return stage && stage.sort_order >= approvedOrder && stage.slug !== "lost";
  });
  const groups = groupBy(jobs, (job) => customerName(job));
  const rows = [...groups.entries()].map(([customer, customerJobs]) => {
    const customerSold = customerJobs.filter((job) => sold.includes(job));
    return {
      customer,
      jobs: customerJobs.length,
      repeat: customerJobs.length > 1 ? "Yes" : "No",
      soldJobs: customerSold.length,
      revenue: currency(sum(customerSold.map(amount))),
    };
  }).sort((a, b) => moneyNumber(b.revenue) - moneyNumber(a.revenue));
  return {
    id: "customer-value",
    title: "Customer Value",
    description: "Customer job volume and operational contract revenue.",
    rangeLabel: range.label,
    metrics: [
      metric("Customers", number(rows.length)),
      metric("Repeat customers", number(rows.filter((row) => row.repeat === "Yes").length)),
      metric("Sold revenue", currency(sum(sold.map(amount))), "", "positive"),
      metric("Average revenue/customer", currency(average(rows.map((row) => moneyNumber(row.revenue))))),
    ],
    columns: [
      { key: "customer", label: "Customer" },
      { key: "jobs", label: "Jobs", align: "right" },
      { key: "repeat", label: "Repeat" },
      { key: "soldJobs", label: "Sold jobs", align: "right" },
      { key: "revenue", label: "Revenue", align: "right" },
    ],
    rows,
    chart: chart("Top customers", rows.slice(0, 10).map((row) => ({ label: row.customer, value: moneyNumber(row.revenue), formattedValue: row.revenue }))),
    notes: ["Commercial vs. residential is not shown because the current customer schema does not track that classification."],
  };
}

async function buildPipelineReport(filters: ReportFilters, range: ParsedRange, velocity: boolean): Promise<ReportResult> {
  const [jobs, context] = await Promise.all([getJobs(filters, range, "updated_at"), getPipelineContext()]);
  const total = jobs.length;
  const rows = context.stages
    .filter((stage) => !filters.pipelineStage || stage.slug === filters.pipelineStage)
    .map((stage) => {
      const stageJobs = jobs.filter((job) => resolveStage(job, context)?.slug === stage.slug);
      const ageDays = stageJobs.map((job) => daysSince(job.updated_at));
      return {
        stage: stage.label,
        jobs: stageJobs.length,
        value: currency(sum(stageJobs.map(amount))),
        conversion: percent(rate(stageJobs.length, total)),
        averageDays: `${average(ageDays).toFixed(1)} days`,
        bottleneckScore: Math.round(stageJobs.length * average(ageDays)),
      };
    });
  return {
    id: velocity ? "pipeline-velocity" : "pipeline-funnel",
    title: velocity ? "Pipeline Velocity" : "Pipeline Funnel",
    description: velocity
      ? "Current-stage age based on the last job update. Larger bottleneck scores combine volume and age."
      : "Current stage counts, contract value, share of period jobs, and average age.",
    rangeLabel: range.label,
    metrics: [
      metric("Jobs in cohort", number(total)),
      metric("Pipeline value", currency(sum(jobs.map(amount)))),
      metric("Average stage age", `${average(jobs.map((job) => daysSince(job.updated_at))).toFixed(1)} days`),
      metric("Largest stage", rows.sort((a, b) => b.jobs - a.jobs)[0]?.stage ?? "—"),
    ],
    columns: [
      { key: "stage", label: "Stage" },
      { key: "jobs", label: "Jobs", align: "right" },
      { key: "value", label: "Contract value", align: "right" },
      { key: "conversion", label: "Share of cohort", align: "right" },
      { key: "averageDays", label: "Average age", align: "right" },
      ...(velocity ? [{ key: "bottleneckScore", label: "Bottleneck score", align: "right" as const }] : []),
    ],
    rows,
    chart: chart(velocity ? "Stage bottleneck score" : "Jobs by stage", rows.map((row) => ({
      label: row.stage,
      value: velocity ? row.bottleneckScore : row.jobs,
    }))),
    notes: ["True historical stage-to-stage conversion and time-in-stage require a stage-transition ledger. Current age uses jobs.updated_at and is labeled accordingly."],
  };
}

async function getTasks(filters: ReportFilters, range: ParsedRange) {
  const supabase = await createClient();
  let query = supabase
    .from("job_tasks")
    .select(`
      id, assigned_employee_id, status, completed, completed_at, due_at, due_date, created_at, available_at,
      employee:employees!job_tasks_assigned_employee_id_fkey(id, name),
      task_type:task_types!job_tasks_task_type_id_fkey(name)
    `)
    .lte("available_at", new Date().toISOString())
    .or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString()}`)
    .gte("available_at", range.fromIso)
    .lte("available_at", range.toIso)
    .order("available_at", { ascending: false })
    .limit(RESULT_LIMIT);
  if (filters.employeeId) query = query.eq("assigned_employee_id", filters.employeeId);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((task) => ({
    ...task,
    employee: first(task.employee),
    task_type: first(task.task_type),
  })) as TaskRow[];
}

async function buildTaskReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const tasks = await getTasks(filters, range);
  const completed = tasks.filter((task) => task.completed || task.status === "completed");
  const overdue = tasks.filter(isTaskOverdue);
  const durations = completed
    .filter((task) => task.completed_at)
    .map((task) => (new Date(task.completed_at!).getTime() - new Date(task.created_at).getTime()) / 86_400_000);
  const groups = groupBy(tasks, (task) => task.employee?.name ?? "Unassigned");
  const rows = [...groups.entries()].map(([employee, employeeTasks]) => ({
    employee,
    created: employeeTasks.length,
    completed: employeeTasks.filter((task) => task.completed || task.status === "completed").length,
    overdue: employeeTasks.filter(isTaskOverdue).length,
    completionRate: percent(rate(employeeTasks.filter((task) => task.completed || task.status === "completed").length, employeeTasks.length)),
    topCategory: mostCommon(employeeTasks.map((task) => task.task_type?.name ?? "Uncategorized")),
  }));
  return {
    id: "task-performance",
    title: "Task Performance",
    description: "Task creation, completion, timeliness, ownership, and category for the selected period.",
    rangeLabel: range.label,
    metrics: [
      metric("Created", number(tasks.length)),
      metric("Completed", number(completed.length), percent(rate(completed.length, tasks.length)), "positive"),
      metric("Overdue", number(overdue.length), "", overdue.length ? "warning" : "default"),
      metric("Average completion", `${average(durations).toFixed(1)} days`),
    ],
    columns: [
      { key: "employee", label: "Employee" },
      { key: "created", label: "Created", align: "right" },
      { key: "completed", label: "Completed", align: "right" },
      { key: "overdue", label: "Overdue", align: "right" },
      { key: "completionRate", label: "Completion rate", align: "right" },
      { key: "topCategory", label: "Most-used category" },
    ],
    rows,
    chart: chart("Tasks by employee", rows.map((row) => ({ label: row.employee, value: row.created }))),
    notes: dataLimitNote(tasks.length),
  };
}

async function getAppointments(filters: ReportFilters, range: ParsedRange) {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(`
      id, job_id, assigned_employee_id, appointment_type, status, starts_at, ends_at,
      employee:employees!appointments_assigned_employee_id_fkey(id, name)
    `)
    .gte("starts_at", range.fromIso)
    .lte("starts_at", range.toIso)
    .order("starts_at", { ascending: false })
    .limit(RESULT_LIMIT);
  if (filters.employeeId) query = query.eq("assigned_employee_id", filters.employeeId);
  if (filters.status && filters.status !== "completed") query = query.eq("status", filters.status);
  if (filters.customerId) {
    const { data: jobIds, error: jobError } = await supabase.from("jobs").select("id").eq("customer_id", filters.customerId);
    if (jobError) throw new Error(jobError.message);
    const ids = (jobIds ?? []).map((job) => job.id);
    if (!ids.length) return [] as AppointmentRow[];
    query = query.in("job_id", ids);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const appointments = (data ?? []).map((appointment) => ({
    ...appointment,
    employee: first(appointment.employee),
  })) as AppointmentRow[];
  return filters.status === "completed"
    ? appointments.filter(appointmentHasOccurred)
    : appointments;
}

async function buildCalendarReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const appointments = await getAppointments(filters, range);
  const groups = groupBy(appointments, (appointment) => appointment.employee?.name ?? "Unassigned");
  const rows = [...groups.entries()].map(([employee, items]) => ({
    employee,
    appointments: items.length,
    measures: items.filter((item) => item.appointment_type === "measure").length,
    installs: items.filter((item) => item.appointment_type === "installation").length,
    occurred: items.filter(appointmentHasOccurred).length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
  }));
  return {
    id: "calendar-performance",
    title: "Calendar Activity",
    description: "Appointment ownership, type, and elapsed scheduled activity in the selected period.",
    rangeLabel: range.label,
    metrics: [
      metric("Appointments", number(appointments.length)),
      metric("Measures", number(appointments.filter((item) => item.appointment_type === "measure").length)),
      metric("Installs", number(appointments.filter((item) => item.appointment_type === "installation").length)),
      metric("Occurred", number(appointments.filter(appointmentHasOccurred).length), "", "positive"),
      metric("Cancelled", number(appointments.filter((item) => item.status === "cancelled").length)),
    ],
    columns: [
      { key: "employee", label: "Employee" },
      { key: "appointments", label: "Appointments", align: "right" },
      { key: "measures", label: "Measures", align: "right" },
      { key: "installs", label: "Installs", align: "right" },
      { key: "occurred", label: "Occurred", align: "right" },
      { key: "cancelled", label: "Cancelled", align: "right" },
    ],
    rows,
    chart: chart("Appointments by employee", rows.map((row) => ({ label: row.employee, value: row.appointments }))),
    notes: ["Occurred means the scheduled end time has passed and the appointment was not cancelled. Rescheduled appointments are not reported separately because the current schema does not store a reschedule event."],
  };
}

function appointmentHasOccurred(appointment: AppointmentRow) {
  if (appointment.status === "cancelled") return false;
  const scheduledEnd = appointment.ends_at ?? appointment.starts_at;
  return new Date(scheduledEnd).getTime() <= Date.now();
}

async function buildOperationalDollarsReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const [transitions, context] = await Promise.all([
    getJobStageTransitions(filters, range),
    getPipelineContext(),
  ]);
  const approvedOrder = context.stageBySlug.get("approved")?.sort_order ?? 4;
  const reportingStages = context.stages.filter((stage) => stage.sort_order >= approvedOrder && stage.slug !== "lost");
  const eventByJobAndStage = new Map<string, {
    job: JobRow;
    stage: StageRow;
    contractAmount: number;
    enteredAt: string;
  }>();

  for (const transition of transitions) {
    const stage = resolveStageStatus(transition.to_stage, context);
    if (!stage || stage.sort_order < approvedOrder || stage.slug === "lost") continue;
    const key = `${stage.slug}:${transition.job_id}`;
    if (!eventByJobAndStage.has(key)) {
      eventByJobAndStage.set(key, {
        job: transition.job,
        stage,
        contractAmount: positiveAmount(transition.contract_amount),
        enteredAt: transition.entered_at,
      });
    }
  }

  const events = [...eventByJobAndStage.values()];
  const billedStage = context.stageBySlug.get("billed")
    ?? context.stages.find((stage) => stage.label.trim().toLowerCase() === "billed");
  const sold = events.filter((event) => event.stage.slug === "approved");
  const completed = events.filter((event) => event.stage.slug === "complete");
  const billed = events.filter((event) => event.stage.slug === billedStage?.slug);
  const rows = reportingStages
    .filter((stage) => !filters.pipelineStage || stage.slug === filters.pipelineStage)
    .map((stage) => {
      const stageEvents = events.filter((event) => event.stage.slug === stage.slug);
      const total = sum(stageEvents.map((event) => event.contractAmount));
      return {
        stage: stage.label,
        jobCount: stageEvents.length,
        total: currency(total),
        average: currency(stageEvents.length ? total / stageEvents.length : 0),
      };
    });
  const missing = sold.filter((event) => !event.contractAmount).length;
  return {
    id: "operational-dollars",
    title: "Operational Dollars",
    description: "The original Contract Amount report, integrated into the Reports Center.",
    rangeLabel: range.label,
    metrics: [
      metric("Sold Jobs", currency(sum(sold.map((event) => event.contractAmount))), `${sold.length} jobs`, "positive"),
      metric("Completed Installs", currency(sum(completed.map((event) => event.contractAmount))), `${completed.length} jobs`),
      metric("Billed Jobs", currency(sum(billed.map((event) => event.contractAmount))), `${billed.length} jobs`),
      metric("Missing Contract Amount", number(missing), "Legacy sold jobs", missing ? "warning" : "default"),
    ],
    columns: [
      { key: "stage", label: "Stage" },
      { key: "jobCount", label: "Job count", align: "right" },
      { key: "total", label: "Total Contract Amount", align: "right" },
      { key: "average", label: "Average Contract Amount", align: "right" },
    ],
    rows,
    chart: chart("Contract value by stage", rows.map((row) => ({ label: row.stage, value: moneyNumber(row.total), formattedValue: row.total }))),
    notes: [
      "Each stage is an independent bucket: a job that enters Approved, Complete, and Billed during the selected range contributes to all three.",
      "A job counts once per stage in the selected range. Stage totals use the Contract Amount recorded when the job entered that stage; Billed uses billed_at.",
      ...dataLimitNote(transitions.length),
    ],
  };
}

async function buildFilesReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const supabase = await createClient();
  let attachmentsQuery = supabase
    .from("job_attachments")
    .select("id, job_id, attachment_kind, category, uploaded_by_employee_id, created_at")
    .is("archived_at", null)
    .gte("created_at", range.fromIso)
    .lte("created_at", range.toIso)
    .limit(RESULT_LIMIT);
  if (filters.employeeId) attachmentsQuery = attachmentsQuery.eq("uploaded_by_employee_id", filters.employeeId);
  const [attachmentsResult, layoutsResult, jobs] = await Promise.all([
    attachmentsQuery,
    supabase
      .from("job_layouts")
      .select("id, job_id, created_at")
      .is("archived_at", null)
      .gte("created_at", range.fromIso)
      .lte("created_at", range.toIso)
      .limit(RESULT_LIMIT),
    getJobs(filters, range),
  ]);
  if (attachmentsResult.error) throw new Error(attachmentsResult.error.message);
  if (layoutsResult.error) throw new Error(layoutsResult.error.message);
  const attachments = attachmentsResult.data ?? [];
  const layouts = layoutsResult.data ?? [];
  const withPhoto = new Set(attachments.filter((item) => item.attachment_kind === "photo").map((item) => item.job_id));
  const withLayout = new Set(layouts.map((item) => item.job_id));
  const categories = groupBy(attachments, (item) => item.attachment_kind === "photo" ? "Photos" : item.category || "Documents");
  const rows = [...categories.entries()].map(([category, items]) => ({
    category,
    files: items.length,
    jobs: new Set(items.map((item) => item.job_id)).size,
  })).sort((a, b) => b.files - a.files);
  return {
    id: "file-coverage",
    title: "File & Layout Coverage",
    description: "Files uploaded and job-document coverage for jobs created in the selected period.",
    rangeLabel: range.label,
    metrics: [
      metric("Layouts uploaded", number(layouts.length)),
      metric("Photos uploaded", number(attachments.filter((item) => item.attachment_kind === "photo").length)),
      metric("Documents uploaded", number(attachments.filter((item) => item.attachment_kind === "file").length)),
      metric("Jobs missing layouts", number(jobs.filter((job) => !withLayout.has(job.id)).length)),
      metric("Jobs missing photos", number(jobs.filter((job) => !withPhoto.has(job.id)).length)),
    ],
    columns: [
      { key: "category", label: "Category" },
      { key: "files", label: "Uploads", align: "right" },
      { key: "jobs", label: "Jobs represented", align: "right" },
    ],
    rows,
    chart: chart("Uploads by category", rows.map((row) => ({ label: row.category, value: row.files }))),
  };
}

async function buildCommunicationsReport(filters: ReportFilters, range: ParsedRange): Promise<ReportResult> {
  const supabase = await createClient();
  let messagesQuery = supabase
    .from("messages")
    .select("id, sender_employee_id, created_at, sender:employees!messages_sender_employee_id_fkey(id, name)")
    .is("deleted_at", null)
    .gte("created_at", range.fromIso)
    .lte("created_at", range.toIso)
    .limit(RESULT_LIMIT);
  if (filters.employeeId) messagesQuery = messagesQuery.eq("sender_employee_id", filters.employeeId);
  const [messagesResult, mentionsResult, notificationsResult] = await Promise.all([
    messagesQuery,
    supabase.from("message_mentions").select("message_id, employee_id, read_at, created_at").gte("created_at", range.fromIso).lte("created_at", range.toIso).limit(RESULT_LIMIT),
    supabase.from("employee_notifications").select("id, employee_id, read_at, created_at").gte("created_at", range.fromIso).lte("created_at", range.toIso).limit(RESULT_LIMIT),
  ]);
  const error = messagesResult.error ?? mentionsResult.error ?? notificationsResult.error;
  if (error) throw new Error(error.message);
  const messages = (messagesResult.data ?? []).map((message) => ({ ...message, sender: first(message.sender) as EmployeeRelation }));
  const groups = groupBy(messages, (message) => message.sender?.name ?? "Former employee");
  const rows = [...groups.entries()].map(([employee, items]) => ({ employee, messages: items.length }));
  const mentions = mentionsResult.data ?? [];
  const notifications = notificationsResult.data ?? [];
  return {
    id: "communications-overview",
    title: "Internal Communications",
    description: "Internal message and notification activity supported by the current schema.",
    rangeLabel: range.label,
    metrics: [
      metric("Messages", number(messages.length)),
      metric("Mentions", number(mentions.length)),
      metric("Unread mentions", number(mentions.filter((item) => !item.read_at).length)),
      metric("Unread notifications", number(notifications.filter((item) => !item.read_at).length)),
    ],
    columns: [
      { key: "employee", label: "Employee" },
      { key: "messages", label: "Messages sent", align: "right" },
    ],
    rows,
    chart: chart("Messages by employee", rows.map((row) => ({ label: row.employee, value: row.messages }))),
    notes: ["Response-time metrics are intentionally not shown because the current messaging schema does not identify which message requires a response."],
  };
}

function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function customerName(job: JobRow) {
  const customer = job.customer as CustomerRelation;
  return customer?.full_name || job.customer_name || "Unnamed customer";
}

function amount(job: JobRow) {
  return positiveAmount(job.contract_amount);
}

function positiveAmount(input: string | number | null | undefined) {
  const value = Number(input ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

function rate(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 0;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function percent(value: number) {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function moneyNumber(value: string) {
  return Number(value.replace(/[^0-9.-]+/g, "")) || 0;
}

function metric(label: string, value: string, detail = "", tone: "default" | "positive" | "warning" = "default") {
  return { label, value, detail, tone };
}

function chart(title: string, items: ReportChartItem[]) {
  return { title, items: items.filter((item) => item.value > 0).slice(0, 12) };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

function daysSince(value: string) {
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 86_400_000);
}

function isTaskOverdue(task: TaskRow) {
  if (task.completed || task.status === "completed" || task.status === "cancelled") return false;
  const due = task.due_at ?? (task.due_date ? `${task.due_date}T23:59:59` : null);
  return Boolean(due && new Date(due).getTime() < Date.now());
}

function mostCommon(values: string[]) {
  const groups = groupBy(values, (value) => value);
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? "—";
}

function dataLimitNote(count: number) {
  return count >= RESULT_LIMIT
    ? [`This result reached the ${number(RESULT_LIMIT)}-record safety limit. Narrow the date range or filters for a complete export.`]
    : [];
}
