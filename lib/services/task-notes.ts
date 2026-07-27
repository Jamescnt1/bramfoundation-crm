import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/services/employees";
import type { TaskNote } from "@/components/tasks/types";

const columns = `
  id, task_id, author_employee_id, body, source, created_at, updated_at,
  author:employees!task_notes_author_employee_id_fkey(id, name)
`;

export async function getTaskNotes(taskId: string): Promise<TaskNote[]> {
  await requirePermission("tasks.manage");
  const { data, error } = await createAdminClient()
    .from("task_notes")
    .select(columns)
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize) as TaskNote[];
}

export async function createTaskNote(taskId: string, body: string) {
  const actor = await requirePermission("tasks.manage");
  const admin = createAdminClient();
  const task = await requireTask(admin, taskId);
  const { data, error } = await admin.from("task_notes").insert({
    task_id: taskId,
    author_employee_id: actor.id,
    body: clean(body),
  }).select(columns).single();
  if (error) throw new Error(error.message);
  await audit(admin, actor.id, task, "task_note_created", data.id);
  return normalize(data) as TaskNote;
}

export async function updateTaskNote(noteId: string, taskId: string, body: string) {
  const actor = await requirePermission("tasks.manage");
  const admin = createAdminClient();
  const [task, note] = await Promise.all([
    requireTask(admin, taskId),
    requireNote(admin, noteId, taskId),
  ]);
  if (note.source === "legacy_description") {
    throw new Error("The migrated task description is read-only. Add a new note instead.");
  }
  if (actor.role !== "administrator" && note.author_employee_id !== actor.id) {
    throw new Error("You can only edit your own task notes.");
  }
  const { data, error } = await admin.from("task_notes")
    .update({ body: clean(body) })
    .eq("id", noteId)
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .select(columns)
    .single();
  if (error) throw new Error(error.message);
  await audit(admin, actor.id, task, "task_note_edited", noteId);
  return normalize(data) as TaskNote;
}

export async function deleteTaskNote(noteId: string, taskId: string) {
  const actor = await requirePermission("tasks.manage");
  const admin = createAdminClient();
  const [task, note] = await Promise.all([
    requireTask(admin, taskId),
    requireNote(admin, noteId, taskId),
  ]);
  if (note.source === "legacy_description") {
    throw new Error("The migrated task description cannot be deleted.");
  }
  if (actor.role !== "administrator" && note.author_employee_id !== actor.id) {
    throw new Error("You can only delete your own task notes.");
  }
  const { error } = await admin.from("task_notes").update({
    deleted_at: new Date().toISOString(),
    deleted_by_employee_id: actor.id,
  }).eq("id", noteId).eq("task_id", taskId).is("deleted_at", null);
  if (error) throw new Error(error.message);
  await audit(admin, actor.id, task, "task_note_deleted", noteId);
}

function clean(body: string) {
  const value = body.trim();
  if (!value) throw new Error("Note body is required.");
  if (value.length > 10000) throw new Error("Notes cannot exceed 10,000 characters.");
  return value;
}

function normalize(row: Record<string, unknown>) {
  const relation = row.author;
  return {
    ...row,
    author: Array.isArray(relation) ? relation[0] ?? null : relation ?? null,
  };
}

async function requireTask(admin: ReturnType<typeof createAdminClient>, taskId: string) {
  const { data, error } = await admin.from("job_tasks")
    .select("id, title, job_id")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Task not found.");
  return data;
}

async function requireNote(admin: ReturnType<typeof createAdminClient>, noteId: string, taskId: string) {
  const { data, error } = await admin.from("task_notes")
    .select("id, author_employee_id, source")
    .eq("id", noteId)
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Task note not found.");
  return data;
}

async function audit(
  admin: ReturnType<typeof createAdminClient>,
  actorEmployeeId: string,
  task: { id: string; title: string; job_id: string | null },
  action: string,
  noteId: string,
) {
  const { error } = await admin.from("admin_audit_log").insert({
    actor_employee_id: actorEmployeeId,
    action,
    entity_type: "task_note",
    entity_id: noteId,
    entity_label: task.title,
    details: { task_id: task.id, job_id: task.job_id },
  });
  if (error) throw new Error(error.message);

  if (task.job_id) {
    const descriptions: Record<string, string> = {
      task_note_created: "A task note was added.",
      task_note_edited: "A task note was edited.",
      task_note_deleted: "A task note was deleted.",
    };
    const { error: activityError } = await admin.from("job_activities").insert({
      job_id: task.job_id,
      activity_type: action,
      description: descriptions[action],
    });
    if (activityError) throw new Error(activityError.message);
  }
}
