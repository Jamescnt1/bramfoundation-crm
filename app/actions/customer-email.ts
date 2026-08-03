"use server";

import { revalidatePath } from "next/cache";
import { sendCustomerEmail, setCustomerEmailReplyRead } from "@/lib/services/customer-email";

export async function sendJobCustomerEmail(input: {
  jobId: string; recipient: string; subject: string; body: string;
  templateId?: string | null; attachmentIds?: string[];
}) {
  const result = await sendCustomerEmail(input);
  revalidatePath(`/leads/${input.jobId}`);
  return result;
}

export async function updateCustomerEmailReplyRead(emailId: string, read: boolean) {
  await setCustomerEmailReplyRead(emailId, read);
  revalidatePath("/my-dashboard");
}
