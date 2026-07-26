"use server";

import { revalidatePath } from "next/cache";
import { createJobNote, deleteJobNote, updateJobNote } from "@/lib/services/job-notes";

export async function createJobNoteAction(input: { jobId: string; body: string }) {
  const note = await createJobNote(input.jobId, input.body);
  revalidatePath(`/leads/${input.jobId}`);
  return note;
}

export async function updateJobNoteAction(input: { noteId: string; jobId: string; body: string }) {
  const note = await updateJobNote(input.noteId, input.jobId, input.body);
  revalidatePath(`/leads/${input.jobId}`);
  return note;
}

export async function deleteJobNoteAction(input: { noteId: string; jobId: string }) {
  await deleteJobNote(input.noteId, input.jobId);
  revalidatePath(`/leads/${input.jobId}`);
}
