"use server";

import { revalidatePath } from "next/cache";
import { deleteJobAttachmentPermanently, updateJobAttachmentMetadata } from "@/lib/services/job-attachments";

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

export async function deleteAttachment(input: { jobId: string; attachmentId: string }) {
  await deleteJobAttachmentPermanently(input.attachmentId);
  revalidatePath(`/leads/${input.jobId}`);
}
