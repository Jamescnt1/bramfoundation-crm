import { createClient } from "@/lib/supabase/server";
import type { LeadSource } from "@/lib/services/lead-sources";
import type { TaskType } from "@/components/tasks/types";

export async function getAllLeadSources(): Promise<LeadSource[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_sources")
    .select("id, name, active, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadSource[];
}

export async function getAllTaskTypes(): Promise<TaskType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_types")
    .select("id, name, active, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskType[];
}

export async function createConfigurationItem(table: "lead_sources" | "task_types", name: string) {
  const supabase = await createClient();
  const normalized = validateName(name);
  const { data: last, error: orderError } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  const { error } = await supabase.from(table).insert({
    name: normalized,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) throwFriendly(error, table);
}

export async function updateConfigurationItem(
  table: "lead_sources" | "task_types",
  id: string,
  values: { name: string; active: boolean; sort_order: number },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ ...values, name: validateName(values.name) })
    .eq("id", id);
  if (error) throwFriendly(error, table);
}

export async function removeLeadSource(id: string): Promise<"deleted" | "retired"> {
  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from("lead_sources")
    .select("name")
    .eq("id", id)
    .single();
  if (sourceError) throw new Error(sourceError.message);

  const { count, error: countError } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("lead_source", source.name);
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    const { error } = await supabase.from("lead_sources").update({ active: false }).eq("id", id);
    if (error) throw new Error(error.message);
    return "retired";
  }

  const { error } = await supabase.from("lead_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return "deleted";
}

export async function removeTaskType(id: string): Promise<"deleted" | "retired"> {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("job_tasks")
    .select("id", { count: "exact", head: true })
    .eq("task_type_id", id);
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    const { error } = await supabase.from("task_types").update({ active: false }).eq("id", id);
    if (error) throw new Error(error.message);
    return "retired";
  }

  const { error } = await supabase.from("task_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return "deleted";
}

function validateName(name: string) {
  const value = name.trim().replace(/\s+/g, " ");
  if (!value) throw new Error("Name cannot be blank.");
  return value;
}

function throwFriendly(
  error: { code?: string; message: string },
  table: "lead_sources" | "task_types",
): never {
  if (error.code === "23505") {
    throw new Error(`That ${table === "lead_sources" ? "lead source" : "task type"} already exists.`);
  }
  throw new Error(error.message);
}
