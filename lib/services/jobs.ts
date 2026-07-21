import { supabase } from "@/lib/supabase";

export type Job = {
  id: string;
  customer_id: string | null;
  assigned_employee_id: string | null;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  lead_source: string | null;
  status: string;
  salesperson: string | null;
  next_action: string | null;
  next_action_due: string | null;
  notes: string | null;
  qfloors_job_number: string | null;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  customer: {
    id: string;
    full_name: string;
  } | null;
};

export type JobActivity = {
  id: string;
  job_id?: string;
  activity_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export type JobTask = {
  id: string;
  job_id: string | null;
  customer_id?: string | null;
  title: string;
  description?: string | null;
  assigned_to: string | null;
  assigned_employee_id?: string | null;
  due_date: string | null;
  due_at?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  status?: "open" | "in_progress" | "waiting" | "completed" | "cancelled";
  task_type_id?: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  automation_rule_id?: string | null;
  automation_transition_id?: string | null;
};

export type CreateJobValues = {
  customer_id?: string | null;
  assigned_employee_id?: string | null;
  customer_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  lead_source?: string | null;
  status?: string;
  salesperson?: string | null;
  next_action?: string | null;
  next_action_due?: string | null;
  notes?: string | null;
  qfloors_job_number?: string | null;
};

export type UpdateJobValues =
  Partial<CreateJobValues>;

export const QF_NUMBER_REQUIRED_ERROR = "QF_NUMBER_REQUIRED";

export class QfNumberRequiredError extends Error {
  code = QF_NUMBER_REQUIRED_ERROR;

  constructor() {
    super("QF# is required at Estimate Sent and every later pipeline stage.");
    this.name = "QfNumberRequiredError";
  }
}

export function isQfNumberRequiredError(error: unknown) {
  return (
    error instanceof QfNumberRequiredError ||
    (error instanceof Error &&
      (error.message.includes(QF_NUMBER_REQUIRED_ERROR) ||
        error.message.includes("QF# is required")))
  );
}

export type ActiveSalesQueueJob = Job & {
  pipeline_stage: string;
  pipeline_color_key: string;
  urgency: "overdue" | "today" | "new_lead" | "future_measure";
};

const jobColumns = `
  id,
  customer_id,
  assigned_employee_id,
  customer_name,
  phone,
  email,
  address,
  lead_source,
  status,
  salesperson,
  next_action,
  next_action_due,
  notes,
  qfloors_job_number,
  created_at,
  updated_at
  ,archived_at
  ,archived_by
  ,customer:customers!jobs_customer_id_fkey (
    id,
    full_name
  )
`;

function normalizeJob(job: Record<string, unknown>): Job {
  const relation = job.customer;

  return {
    ...job,
    customer: Array.isArray(relation) ? relation[0] ?? null : relation ?? null,
  } as Job;
}

export async function getJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(jobColumns)
    .is("archived_at", null)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((job) => normalizeJob(job));
}

export async function getActiveSalesQueue(
  today = new Date(),
): Promise<ActiveSalesQueueJob[]> {
  const jobs = await getJobs();
  const [stagesResult, aliasesResult] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("slug, label, color_key")
      .eq("active", true)
      .eq("lead_queue", true)
      .order("sort_order"),
    supabase
      .from("pipeline_stage_aliases")
      .select("alias, stage_slug"),
  ]);

  // The fallback keeps the daily sales queue available while a newly deployed
  // database migration is being applied. Configured values take precedence.
  const queueStages = stagesResult.error
    ? DEFAULT_SALES_QUEUE_STAGES
    : stagesResult.data ?? DEFAULT_SALES_QUEUE_STAGES;
  const stageAliases = aliasesResult.error
    ? DEFAULT_PIPELINE_ALIASES
    : Object.fromEntries(
        (aliasesResult.data ?? []).map((entry) => [entry.alias, entry.stage_slug]),
      );
  const todayKey = formatLocalDateKey(today);

  return jobs
    .map((job) => {
      const resolvedSlug = stageAliases[job.status] ?? job.status;
      return {
        job,
        stage: queueStages.find(
          (stage) => stage.slug === resolvedSlug || stage.label === job.status,
        ),
      };
    })
    .filter((entry) => Boolean(entry.stage))
    .map(({ job, stage }) => {
      const pipelineStage = stage!.label;

      return {
        ...job,
        pipeline_stage: pipelineStage,
        pipeline_color_key: stage!.color_key,
        urgency: getSalesQueueUrgency(
          stage!.slug,
          job.next_action_due,
          todayKey,
        ),
      };
    })
    .sort((first, second) => {
      const urgencyDifference =
        SALES_QUEUE_URGENCY_ORDER[first.urgency] -
        SALES_QUEUE_URGENCY_ORDER[second.urgency];

      if (urgencyDifference !== 0) {
        return urgencyDifference;
      }

      const firstDue = first.next_action_due ?? "9999-12-31";
      const secondDue = second.next_action_due ?? "9999-12-31";
      const dueDifference = firstDue.localeCompare(secondDue);

      if (dueDifference !== 0) {
        return dueDifference;
      }

      return (
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime()
      );
    });
}

const DEFAULT_SALES_QUEUE_STAGES = [
  { slug: "new_lead", label: "New Lead", color_key: "blue" },
  { slug: "floor_measure", label: "Floor Measure", color_key: "amber" },
];

const DEFAULT_PIPELINE_ALIASES: Record<string, string> = {
  "New Lead": "new_lead",
  Contacted: "new_lead",
  Appointment: "floor_measure",
  "Measure Complete": "floor_measure",
  "Floor Measure": "floor_measure",
};

const SALES_QUEUE_URGENCY_ORDER = {
  overdue: 0,
  today: 1,
  new_lead: 2,
  future_measure: 3,
} as const;

function getSalesQueueUrgency(
  stage: string,
  dueDate: string | null,
  todayKey: string,
): ActiveSalesQueueJob["urgency"] {
  if (dueDate && dueDate < todayKey) {
    return "overdue";
  }

  if (stage === "floor_measure" && dueDate === todayKey) {
    return "today";
  }

  if (stage === "new_lead") {
    return "new_lead";
  }

  return "future_measure";
}

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function getJobsByCustomerId(
  customerId: string,
): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(jobColumns)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((job) => normalizeJob(job));
}

export async function getJobById(
  id: string,
): Promise<Job | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select(jobColumns)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? normalizeJob(data) : null;
}

export async function getJobActivities(
  jobId: string,
): Promise<JobActivity[]> {
  const { data, error } = await supabase
    .from("job_activities")
    .select(
      `
        id,
        job_id,
        activity_type,
        description,
        old_value,
        new_value,
        created_at
      `,
    )
    .eq("job_id", jobId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as JobActivity[];
}

export async function getJobTasks(
  jobId: string,
): Promise<JobTask[]> {
  const { data, error } = await supabase
    .from("job_tasks")
    .select(
      `
        id,
        job_id,
        customer_id,
        title,
        description,
        assigned_to,
        assigned_employee_id,
        due_date,
        due_at,
        priority,
        status,
        task_type_id,
        completed,
        completed_at,
        created_at
      `,
    )
    .eq("job_id", jobId)
    .order("completed", {
      ascending: true,
    })
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as JobTask[];
}

export async function createJob(
  values: CreateJobValues,
): Promise<Job> {
  const qfNumber = values.qfloors_job_number?.trim() || null;

  if (await databaseRequiresQfNumber(values.status ?? "New Lead") && !qfNumber) {
    throw new QfNumberRequiredError();
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      customer_id: values.customer_id ?? null,
      assigned_employee_id:
        values.assigned_employee_id ??
        (await findEmployeeIdByName(values.salesperson)),
      customer_name: values.customer_name.trim(),
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      address: values.address?.trim() || null,
      lead_source: values.lead_source || null,
      status: (await normalizePipelineStatus(values.status ?? "New Lead")),
      salesperson: values.salesperson || null,
      next_action:
        values.next_action?.trim() || null,
      next_action_due:
        values.next_action_due || null,
      notes: values.notes?.trim() || null,
      qfloors_job_number: qfNumber,
    })
    .select(jobColumns)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeJob(data);
}

export async function updateJob(
  id: string,
  values: UpdateJobValues,
): Promise<Job> {
  const currentJob = await getJobById(id);

  if (!currentJob) {
    throw new Error("Job not found.");
  }

  const resultingStatus = values.status ?? currentJob.status;
  const resultingQfNumber =
    values.qfloors_job_number !== undefined
      ? values.qfloors_job_number?.trim() || null
      : currentJob.qfloors_job_number?.trim() || null;

  if (await databaseRequiresQfNumber(resultingStatus) && !resultingQfNumber) {
    throw new QfNumberRequiredError();
  }

  const updates: Record<string, unknown> = {};

  if (values.customer_id !== undefined) {
    updates.customer_id = values.customer_id;
  }

  if (values.assigned_employee_id !== undefined) {
    updates.assigned_employee_id = values.assigned_employee_id;
  } else if (values.salesperson !== undefined) {
    updates.assigned_employee_id = await findEmployeeIdByName(values.salesperson);
  }

  if (values.customer_name !== undefined) {
    updates.customer_name =
      values.customer_name.trim();
  }

  if (values.phone !== undefined) {
    updates.phone =
      values.phone?.trim() || null;
  }

  if (values.email !== undefined) {
    updates.email =
      values.email?.trim() || null;
  }

  if (values.address !== undefined) {
    updates.address =
      values.address?.trim() || null;
  }

  if (values.lead_source !== undefined) {
    updates.lead_source =
      values.lead_source || null;
  }

  if (values.status !== undefined) {
    updates.status = await normalizePipelineStatus(values.status);
  }

  if (values.salesperson !== undefined) {
    updates.salesperson =
      values.salesperson || null;
  }

  if (values.next_action !== undefined) {
    updates.next_action =
      values.next_action?.trim() || null;
  }

  if (values.next_action_due !== undefined) {
    updates.next_action_due =
      values.next_action_due || null;
  }

  if (values.notes !== undefined) {
    updates.notes =
      values.notes?.trim() || null;
  }

  if (
    values.qfloors_job_number !== undefined
  ) {
    updates.qfloors_job_number =
      values.qfloors_job_number?.trim() || null;
  }

  const { data, error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", id)
    .select(jobColumns)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeJob(data);
}

export async function moveJobToStatus(
  id: string,
  status: string,
  qfNumber?: string,
): Promise<Job> {
  // Database triggers write the status activity and create any task
  // configured for this transition in automation_rules.
  return updateJob(id, {
    status,
    ...(qfNumber !== undefined
      ? { qfloors_job_number: qfNumber }
      : {}),
  });
}


async function findEmployeeIdByName(name: string | null | undefined) {
  if (!name) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .eq("name", name)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function getConfiguredStage(status: string) {
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("slug, label, qf_number_required")
    .eq("active", true);
  if (error) {
    // Keeps older deployments usable until the pipeline migration is applied.
    return null;
  }
  return (data ?? []).find((stage) => stage.slug === status || stage.label === status) ?? null;
}

async function normalizePipelineStatus(status: string) {
  return (await getConfiguredStage(status))?.slug ?? status;
}

async function databaseRequiresQfNumber(status: string) {
  const stage = await getConfiguredStage(status);
  if (stage) return stage.qf_number_required;
  const legacyOrder = ["New Lead", "Floor Measure", "Estimate Sent", "Waiting Approval", "Approved", "Materials Ordered", "Install Scheduled", "Complete", "Lost"];
  return legacyOrder.indexOf(status) >= legacyOrder.indexOf("Estimate Sent");
}
