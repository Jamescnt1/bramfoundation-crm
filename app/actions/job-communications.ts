"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/services/employees";
import { updateJob } from "@/lib/services/jobs";

export async function updateJobCommunicationPreferencesAction(input: {
  jobId: string;
  mode: "off" | "inherit" | "on";
  channel: "inherit" | "email" | "sms" | "both";
}) {
  await requirePermission("communications.manage");
  const job = await updateJob(input.jobId, {
    customer_communication_mode: input.mode,
    preferred_communication_channel: input.channel,
  });
  revalidatePath(`/leads/${input.jobId}`);
  return {
    mode: job.customer_communication_mode,
    channel: job.preferred_communication_channel,
  };
}
