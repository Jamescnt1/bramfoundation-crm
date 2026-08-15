import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/services/employees";

export type JobNote = {
  id: string;
  job_id: string;
  author_employee_id: string | null;
  body: string;
  source: "manual" | "job_form" | "task" | "appointment" | "production" | "hold" | "layout";
  created_at: string;
  updated_at: string;
  author: { id: string; name: string } | null;
  source_label?: string | null;
  source_detail?: string | null;
  source_href?: string | null;
};

const columns = `
  id, job_id, author_employee_id, body, source, created_at, updated_at,
  author:employees!job_notes_author_employee_id_fkey (id, name)
`;

export async function getJobNotes(jobId: string): Promise<JobNote[]> {
  await requirePermission("job_notes.view");
  const admin = createAdminClient();
  const [jobNotesResult, tasksResult, appointmentsResult, productionResult, jobResult, layoutsResult] = await Promise.all([
    admin
    .from("job_notes")
    .select(columns)
    .eq("job_id", jobId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false }),
    admin.from("job_tasks").select("id, title").eq("job_id", jobId),
    admin.from("appointments").select("id, appointment_type, title, notes, starts_at, created_at, updated_at")
      .eq("job_id", jobId).not("notes", "is", null),
    admin.from("job_material_scopes").select("id, description, issue_note, completion_check_notes, created_at, updated_at, category:material_categories!job_material_scopes_material_category_id_fkey(name)")
      .eq("job_id", jobId),
    admin.from("jobs").select("hold_note, held_at, updated_at").eq("id", jobId).maybeSingle(),
    admin.from("job_layouts").select("id, name, notes, created_at, updated_at").eq("job_id", jobId).is("archived_at", null).not("notes", "is", null),
  ]);
  const firstError = jobNotesResult.error ?? tasksResult.error ?? appointmentsResult.error ?? productionResult.error ?? jobResult.error ?? layoutsResult.error;
  if (firstError) throw new Error(firstError.message);

  const notes = (jobNotesResult.data ?? []).map(normalize) as JobNote[];
  const tasks = tasksResult.data ?? [];
  if (tasks.length) {
    const taskNames = new Map(tasks.map((task) => [task.id, task.title]));
    const { data: taskNotes, error } = await admin.from("task_notes")
      .select("id, task_id, author_employee_id, body, created_at, updated_at, author:employees!task_notes_author_employee_id_fkey(id, name)")
      .in("task_id", tasks.map((task) => task.id)).is("deleted_at", null);
    if (error) throw new Error(error.message);
    for (const note of taskNotes ?? []) {
      const author = first(note.author);
      notes.push({ id: `task:${note.id}`, job_id: jobId, author_employee_id: note.author_employee_id, body: note.body,
        source: "task", created_at: note.created_at, updated_at: note.updated_at, author,
        source_label: "Task note", source_detail: `${taskNames.get(note.task_id) ?? "Task"}${author?.name ? ` · ${author.name}` : ""}`, source_href: `/tasks?task=${note.task_id}` });
    }
  }
  for (const appointment of appointmentsResult.data ?? []) {
    const body = appointment.notes?.trim(); if (!body) continue;
    notes.push({ id: `appointment:${appointment.id}`, job_id: jobId, author_employee_id: null, body, source: "appointment",
      created_at: appointment.created_at ?? appointment.starts_at, updated_at: appointment.updated_at ?? appointment.created_at ?? appointment.starts_at,
      author: null, source_label: "Appointment note", source_detail: `${label(appointment.appointment_type)} · ${shortDate(appointment.starts_at)}`, source_href: `/calendar?appointment=${appointment.id}` });
  }
  for (const scope of productionResult.data ?? []) {
    const category = first(scope.category)?.name ?? scope.description ?? "Production scope";
    if (scope.issue_note?.trim()) notes.push(operationalNote(`production-issue:${scope.id}`, jobId, scope.issue_note, "Production issue", category, scope.updated_at ?? scope.created_at, `/leads/${jobId}?tab=production`));
    if (scope.completion_check_notes?.trim()) notes.push(operationalNote(`production-check:${scope.id}`, jobId, scope.completion_check_notes, "Completion note", category, scope.updated_at ?? scope.created_at, `/leads/${jobId}?tab=production`));
  }
  if (jobResult.data?.hold_note?.trim()) notes.push(operationalNote("hold:current", jobId, jobResult.data.hold_note, "Hold note", "Job hold", jobResult.data.held_at ?? jobResult.data.updated_at, `/leads/${jobId}`, "hold"));
  for (const layout of layoutsResult.data ?? []) {
    if (!layout.notes?.trim()) continue;
    notes.push({ ...operationalNote(`layout:${layout.id}`, jobId, layout.notes, "Layout note", layout.name, layout.updated_at ?? layout.created_at, `/leads/${jobId}?tab=layouts`), source: "layout" });
  }
  return notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createJobNote(jobId: string, body: string) {
  const actor = await requirePermission("job_notes.create");
  const cleanBody = clean(body);
  const admin = createAdminClient();
  await requireActiveJob(admin, jobId);
  const { data, error } = await admin.from("job_notes").insert({
    job_id: jobId,
    author_employee_id: actor.id,
    body: cleanBody,
  }).select(columns).single();
  if (error) throw new Error(error.message);
  await log(admin, jobId, "job_note_created", `${actor.name} added a job note.`);
  return normalize(data) as JobNote;
}

export async function updateJobNote(noteId: string, jobId: string, body: string) {
  const actor = await requirePermission("job_notes.edit");
  const admin = createAdminClient();
  const note = await requireNote(admin, noteId, jobId);
  if (note.source === "job_form") throw new Error("Edit this note through Edit Job Info.");
  if (actor.role !== "administrator" && note.author_employee_id !== actor.id) {
    throw new Error("You can only edit your own job notes.");
  }
  const { data, error } = await admin.from("job_notes")
    .update({ body: clean(body) })
    .eq("id", noteId).eq("job_id", jobId).is("deleted_at", null)
    .select(columns).single();
  if (error) throw new Error(error.message);
  await log(admin, jobId, "job_note_edited", `${actor.name} edited a job note.`);
  return normalize(data) as JobNote;
}

export async function deleteJobNote(noteId: string, jobId: string) {
  const actor = await requirePermission("job_notes.delete");
  const admin = createAdminClient();
  const note = await requireNote(admin, noteId, jobId);
  if (note.source === "job_form") throw new Error("Remove this note through Edit Job Info.");
  const { error } = await admin.from("job_notes").update({
    deleted_at: new Date().toISOString(),
    deleted_by_employee_id: actor.id,
  }).eq("id", noteId).eq("job_id", jobId).is("deleted_at", null);
  if (error) throw new Error(error.message);
  await log(admin, jobId, "job_note_deleted", `${actor.name} deleted a job note.`);
}

function clean(body: string) {
  const value = body.trim();
  if (!value) throw new Error("Note body is required.");
  if (value.length > 10000) throw new Error("Notes cannot exceed 10,000 characters.");
  return value;
}

function normalize(row: Record<string, unknown>) {
  const relation = row.author;
  const author = Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
  return { ...row, author,
    source_label: row.source === "job_form" ? "Job information note" : "Job note",
    source_detail: row.source === "manual" && author && typeof author === "object" && "name" in author ? author.name : null };
}

function first<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function label(value: string | null) { return (value ?? "appointment").split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function shortDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }
function operationalNote(id: string, jobId: string, body: string, sourceLabel: string, detail: string, timestamp: string, href: string, source: JobNote["source"] = "production"): JobNote {
  return { id, job_id: jobId, author_employee_id: null, body: body.trim(), source, created_at: timestamp, updated_at: timestamp, author: null, source_label: sourceLabel, source_detail: detail, source_href: href };
}

async function requireActiveJob(admin: ReturnType<typeof createAdminClient>, jobId: string) {
  const { data, error } = await admin.from("jobs").select("id").eq("id", jobId).is("archived_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job not found.");
}

async function requireNote(admin: ReturnType<typeof createAdminClient>, noteId: string, jobId: string) {
  const { data, error } = await admin.from("job_notes").select("id, author_employee_id, source").eq("id", noteId).eq("job_id", jobId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job note not found.");
  return data;
}

async function log(admin: ReturnType<typeof createAdminClient>, jobId: string, type: string, description: string) {
  const { error } = await admin.from("job_activities").insert({ job_id: jobId, activity_type: type, description });
  if (error) throw new Error(error.message);
}
