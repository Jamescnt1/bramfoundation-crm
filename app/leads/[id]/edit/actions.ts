"use server";

import { revalidatePath } from "next/cache";
import { archiveLead } from "@/lib/services/record-lifecycle";

export async function archiveLeadAction(jobId: string) {
  if (!jobId) throw new Error("Lead ID is required.");
  await archiveLead(jobId);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/customers");
}
