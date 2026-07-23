import { createClient } from "@/lib/supabase/server";
import type { LeadSource } from "@/lib/services/lead-sources";
import type { TaskType } from "@/components/tasks/types";
import type { InstallerCrew } from "@/lib/services/installer-crews";

type ConfigurationTable = "lead_sources" | "task_types" | "installer_crews";

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

export async function getAllInstallerCrews(): Promise<InstallerCrew[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("installer_crews")
    .select("id, name, active, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as InstallerCrew[];
}

export async function createConfigurationItem(table: ConfigurationTable, name: string) {
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
  table: ConfigurationTable,
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

export async function removeInstallerCrew(id: string): Promise<"deleted" | "retired"> {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("installer_crew_id", id);
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    const { error } = await supabase.from("installer_crews").update({ active: false }).eq("id", id);
    if (error) throw new Error(error.message);
    return "retired";
  }

  const { error } = await supabase.from("installer_crews").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return "deleted";
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
  table: ConfigurationTable,
): never {
  if (error.code === "23505") {
    const label = table === "lead_sources" ? "lead source" : table === "task_types" ? "task type" : "install crew";
    throw new Error(`That ${label} already exists.`);
  }
  throw new Error(error.message);
}
