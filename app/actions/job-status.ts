"use server";

import { revalidatePath } from "next/cache";
import type { PipelineStage } from "@/components/pipeline/constants";
import { updateJobPipelineStatus } from "@/lib/services/job-status";
import { deliverQueuedEmailsForJob } from "@/lib/services/customer-email";

export async function changeJobPipelineStatus(
  jobId: string,
  status: PipelineStage,
  qfNumber?: string,
) {
  const updated = await updateJobPipelineStatus(jobId, status, qfNumber);
  await deliverQueuedEmailsForJob(jobId);

  revalidatePath(`/leads/${jobId}`);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/customers");
  if (updated.customer_id) revalidatePath(`/customers/${updated.customer_id}`);

  return updated;
}
