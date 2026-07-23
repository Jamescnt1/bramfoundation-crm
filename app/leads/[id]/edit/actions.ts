"use server";

import { revalidatePath } from "next/cache";
import { deleteLeadPermanently } from "@/lib/services/record-lifecycle";

export async function deleteLeadAction(jobId: string) {
  if (!jobId) throw new Error("Lead ID is required.");
  await deleteLeadPermanently(jobId);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/customers");
}
