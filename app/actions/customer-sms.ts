"use server";

import { revalidatePath } from "next/cache";
import { sendJobCustomerSms } from "@/lib/services/customer-sms";

export async function sendJobCustomerSmsAction(input: { jobId: string; recipient: string; body: string }) {
  try {
    const result = await sendJobCustomerSms(input);
    revalidatePath(`/leads/${input.jobId}`);
    return { ok: true as const, result };
  } catch (caught) {
    return { ok: false as const, error: caught instanceof Error ? caught.message : "Unable to send the text message." };
  }
}
