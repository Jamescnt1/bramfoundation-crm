"use server";

import { revalidatePath } from "next/cache";
import { archiveJobAttachment, updateJobAttachmentMetadata } from "@/lib/services/job-attachments";

export async function editJobAttachment(input: {
  jobId: string;
  attachmentId: string;
  fileName: string;
  category: string;
  description: string | null;
}) {
  await updateJobAttachmentMetadata(input);
  revalidatePath(`/leads/${input.jobId}`);
}

export async function archiveAttachment(input: { jobId: string; attachmentId: string }) {
  await archiveJobAttachment(input.attachmentId);
  revalidatePath(`/leads/${input.jobId}`);
}
