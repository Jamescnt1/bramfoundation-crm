"use server";

import { revalidatePath } from "next/cache";
import { archiveCustomer } from "@/lib/services/record-lifecycle";

export async function archiveCustomerAction(customerId: string) {
  if (!customerId) throw new Error("Customer ID is required.");
  const result = await archiveCustomer(customerId);
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return result;
}
