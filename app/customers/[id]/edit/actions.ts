"use server";

import { revalidatePath } from "next/cache";
import { deleteCustomerPermanently } from "@/lib/services/record-lifecycle";

export async function deleteCustomerAction(customerId: string) {
  if (!customerId) throw new Error("Customer ID is required.");
  const result = await deleteCustomerPermanently(customerId);
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return result;
}
