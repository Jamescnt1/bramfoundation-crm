"use server";

import { revalidatePath } from "next/cache";
import { sendCustomerEmail } from "@/lib/services/customer-email";

export async function sendJobCustomerEmail(input: {
  jobId: string; recipient: string; subject: string; body: string;
  templateId?: string | null; attachmentIds?: string[];
}) {
  const result = await sendCustomerEmail(input);
  revalidatePath(`/leads/${input.jobId}`);
  return result;
}
