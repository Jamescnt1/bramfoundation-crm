"use server";

import { revalidatePath } from "next/cache";
import type { LayoutDocument, LayoutTemplate } from "@/components/layouts/types";
import { archiveJobLayout, createJobLayout, saveJobLayout } from "@/lib/services/job-layouts";

export async function createLayout(input: { jobId: string; name: string; template: LayoutTemplate }) {
  const result = await createJobLayout(input);
  revalidatePath(`/leads/${input.jobId}`);
  return result;
}

export async function saveLayout(input: {
  layoutId: string;
  jobId: string;
  name: string;
  document: LayoutDocument;
  expectedUpdatedAt: string;
}) {
  return saveJobLayout(input);
}

export async function archiveLayout(input: { layoutId: string; jobId: string }) {
  await archiveJobLayout(input);
  revalidatePath(`/leads/${input.jobId}`);
}
