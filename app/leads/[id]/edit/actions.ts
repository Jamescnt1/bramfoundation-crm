"use server";

import { revalidatePath } from "next/cache";
import { deleteLeadPermanently } from "@/lib/services/record-lifecycle";
import { requirePermission } from "@/lib/services/employees";
import { updateJob, type UpdateJobValues } from "@/lib/services/jobs";

export async function updateJobInfoAction(jobId: string, values: UpdateJobValues) {
  if (!jobId) throw new Error("Job ID is required.");
  await requirePermission("jobs.manage");
  const job = await updateJob(jobId, values);
  revalidatePath(`/leads/${jobId}`);
  revalidatePath(`/leads/${jobId}/edit`);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/customers");
  return job;
}

export async function deleteLeadAction(jobId: string) {
  if (!jobId) throw new Error("Lead ID is required.");
  await deleteLeadPermanently(jobId);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/customers");
}
