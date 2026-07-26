import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/services/employees";

export type JobNote = {
  id: string;
  job_id: string;
  author_employee_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  author: { id: string; name: string } | null;
};

const columns = `
  id, job_id, author_employee_id, body, created_at, updated_at,
  author:employees!job_notes_author_employee_id_fkey (id, name)
`;

export async function getJobNotes(jobId: string): Promise<JobNote[]> {
  await requirePermission("job_notes.view");
  const { data, error } = await createAdminClient()
    .from("job_notes")
    .select(columns)
    .eq("job_id", jobId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize) as JobNote[];
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
  await requireNote(admin, noteId, jobId);
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
  return { ...row, author: Array.isArray(relation) ? relation[0] ?? null : relation ?? null };
}

async function requireActiveJob(admin: ReturnType<typeof createAdminClient>, jobId: string) {
  const { data, error } = await admin.from("jobs").select("id").eq("id", jobId).is("archived_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job not found.");
}

async function requireNote(admin: ReturnType<typeof createAdminClient>, noteId: string, jobId: string) {
  const { data, error } = await admin.from("job_notes").select("id, author_employee_id").eq("id", noteId).eq("job_id", jobId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job note not found.");
  return data;
}

async function log(admin: ReturnType<typeof createAdminClient>, jobId: string, type: string, description: string) {
  const { error } = await admin.from("job_activities").insert({ job_id: jobId, activity_type: type, description });
  if (error) throw new Error(error.message);
}
