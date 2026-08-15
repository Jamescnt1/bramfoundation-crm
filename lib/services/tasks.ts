import { supabase } from "@/lib/supabase";
import type { TaskPriority, TaskStatus, TaskType, UniversalTask } from "@/components/tasks/types";

export type TaskValues = {
  title: string; description: string | null; assigned_employee_id: string | null;
  due_at: string | null; priority: TaskPriority; status: TaskStatus;
  snoozed_until: string | null;
  task_type_id: string | null; customer_id: string | null; job_id: string | null;
};

const columns = `id, job_id, customer_id, title, description, assigned_to,
 assigned_employee_id, due_date, due_at, snoozed_until, priority, status, completed, completed_at,
 created_at, updated_at, task_type_id,
 customers(id, full_name), jobs(id, customer_name, qfloors_job_number, customer:customers!jobs_customer_id_fkey(id, full_name)),
 employees!job_tasks_assigned_employee_id_fkey(id, name), task_types(id, name, active, sort_order)`;

export async function getTasks(filters?: { jobId?: string; customerId?: string }) {
  const now = new Date().toISOString();
  let query = supabase
    .from("job_tasks")
    .select(columns)
    .lte("available_at", now)
    .order("completed")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (filters?.jobId) query = query.eq("job_id", filters.jobId);
  else {
    query = query.or(`snoozed_until.is.null,snoozed_until.lte.${now}`);
    if (filters?.customerId) query = query.eq("customer_id", filters.customerId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const tasks = (data ?? []).map(normalizeTask) as UniversalTask[];
  if (!tasks.length) return tasks;

  const { data: notes, error: notesError } = await supabase
    .from("task_latest_notes")
    .select("id, task_id, author_employee_id, body, source, created_at, updated_at, author_name")
    .in("task_id", tasks.map((task) => task.id))
    .order("created_at", { ascending: false });
  if (notesError) throw new Error(notesError.message);

  const latestByTask = new Map<string, UniversalTask["latest_note"]>();
  for (const rawNote of notes ?? []) {
    if (latestByTask.has(rawNote.task_id)) continue;
    latestByTask.set(rawNote.task_id, {
      id: rawNote.id,
      task_id: rawNote.task_id,
      author_employee_id: rawNote.author_employee_id,
      body: rawNote.body,
      source: rawNote.source,
      created_at: rawNote.created_at,
      updated_at: rawNote.updated_at,
      author: rawNote.author_employee_id
        ? { id: rawNote.author_employee_id, name: rawNote.author_name ?? "Former employee" }
        : null,
    });
  }

  return tasks.map((task) => ({
    ...task,
    latest_note: latestByTask.get(task.id) ?? null,
  }));
}

export async function getTaskTypes(activeOnly = true): Promise<TaskType[]> {
  let query = supabase.from("task_types").select("id, name, active, sort_order").order("sort_order").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskType[];
}

export async function createTask(values: TaskValues) {
  validateTaskRelationship(values);
  const assignedName = await employeeName(values.assigned_employee_id);
  const { data, error } = await supabase.from("job_tasks").insert({ ...clean(values), assigned_to: assignedName }).select(columns).single();
  if (error) throw new Error(error.message);
  return normalizeTask(data) as UniversalTask;
}

export async function updateTask(id: string, values: TaskValues) {
  validateTaskRelationship(values);
  const assignedName = await employeeName(values.assigned_employee_id);
  const { data, error } = await supabase.from("job_tasks").update({ ...clean(values), assigned_to: assignedName }).eq("id", id).select(columns).single();
  if (error) throw new Error(error.message);
  return normalizeTask(data) as UniversalTask;
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const { error } = await supabase.from("job_tasks").update({
    status,
    ...(status === "completed" || status === "cancelled" ? { snoozed_until: null } : {}),
  }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createTaskType(name: string) {
  const normalized = validateTypeName(name);
  const { data: last } = await supabase.from("task_types").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("task_types").insert({ name: normalized, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error?.code === "23505") throw new Error("That task type already exists.");
  if (error) throw new Error(error.message);
}
export async function updateTaskType(id: string, values: { name: string; active: boolean; sort_order: number }) {
  const { error } = await supabase.from("task_types").update({ name: validateTypeName(values.name), active: values.active, sort_order: values.sort_order }).eq("id", id);
  if (error?.code === "23505") throw new Error("That task type already exists.");
  if (error) throw new Error(error.message);
}
export async function reorderTaskTypes(items: TaskType[]) {
  await Promise.all(items.map((item, index) => updateTaskType(item.id, { ...item, sort_order: index })));
}

function validateTypeName(name: string) { const value = name.trim().replace(/\s+/g, " "); if (!value) throw new Error("Name cannot be blank."); return value; }

function validateTaskRelationship(values: TaskValues) {
  if (!values.title.trim()) throw new Error("Task title is required.");
}
function clean(values: TaskValues) { return { ...values, title: values.title.trim(), description: values.description?.trim() || null }; }
async function employeeName(id: string | null) {
  if (!id) return null;
  const { data, error } = await supabase.from("employees").select("name").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data.name as string;
}
function normalizeTask(task: Record<string, unknown>) {
  for (const key of ["customers", "jobs", "employees", "task_types"] as const) {
    const value = task[key];
    if (Array.isArray(value)) task[key] = value[0] ?? null;
  }
  const job = task.jobs;
  if (job && typeof job === "object" && !Array.isArray(job)) {
    const customer = (job as Record<string, unknown>).customer;
    if (Array.isArray(customer)) {
      (job as Record<string, unknown>).customer = customer[0] ?? null;
    }
  }
  return { ...task, latest_note: null };
}
