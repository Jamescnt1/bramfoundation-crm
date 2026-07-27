"use server";

import { revalidatePath } from "next/cache";
import {
  createTaskNote,
  deleteTaskNote,
  getTaskNotes,
  updateTaskNote,
} from "@/lib/services/task-notes";

export async function getTaskNotesAction(taskId: string) {
  return getTaskNotes(taskId);
}

export async function createTaskNoteAction(input: { taskId: string; body: string }) {
  const note = await createTaskNote(input.taskId, input.body);
  revalidateTaskViews();
  return note;
}

export async function updateTaskNoteAction(input: { noteId: string; taskId: string; body: string }) {
  const note = await updateTaskNote(input.noteId, input.taskId, input.body);
  revalidateTaskViews();
  return note;
}

export async function deleteTaskNoteAction(input: { noteId: string; taskId: string }) {
  await deleteTaskNote(input.noteId, input.taskId);
  revalidateTaskViews();
}

function revalidateTaskViews() {
  revalidatePath("/tasks");
  revalidatePath("/my-dashboard");
}
