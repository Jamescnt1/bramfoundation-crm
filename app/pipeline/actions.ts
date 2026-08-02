"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

export type PipelineCardSize = "small" | "medium" | "large";
export type PipelineSortOrder = "newest" | "oldest" | "alphabetical";

const pipelineCardSizes: PipelineCardSize[] = ["small", "medium", "large"];
const pipelineSortOrders: PipelineSortOrder[] = ["newest", "oldest", "alphabetical"];

export async function updatePipelineCardSizeAction(value: string) {
  const employee = await requireEmployee();
  if (!pipelineCardSizes.includes(value as PipelineCardSize)) {
    throw new Error("Select a valid pipeline card size.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("employees")
    .update({ pipeline_card_size: value })
    .eq("id", employee.id);

  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
}

export async function updatePipelineSortOrderAction(value: string) {
  const employee = await requireEmployee();
  if (!pipelineSortOrders.includes(value as PipelineSortOrder)) {
    throw new Error("Select a valid pipeline sort order.");
  }

  const { error } = await createAdminClient()
    .from("employees")
    .update({ pipeline_sort_order: value })
    .eq("id", employee.id);

  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
}
