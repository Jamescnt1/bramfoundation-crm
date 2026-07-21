import { createClient } from "@/lib/supabase/server";

export type LeadSource = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export async function getLeadSources(activeOnly = true): Promise<LeadSource[]> {
  const supabase = await createClient();
  let query = supabase
    .from("lead_sources")
    .select("id, name, active, sort_order")
    .order("sort_order")
    .order("name");

  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadSource[];
}

export async function createLeadSource(name: string) {
  const supabase = await createClient();
  const normalized = validateName(name);
  const { data: last } = await supabase
    .from("lead_sources")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("lead_sources").insert({
    name: normalized,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) throwFriendly(error);
}

export async function updateLeadSource(
  id: string,
  values: Pick<LeadSource, "name" | "active" | "sort_order">,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_sources")
    .update({ ...values, name: validateName(values.name) })
    .eq("id", id);
  if (error) throwFriendly(error);
}

export async function reorderLeadSources(items: LeadSource[]) {
  await Promise.all(
    items.map((item, index) =>
      updateLeadSource(item.id, { ...item, sort_order: index }),
    ),
  );
}

function validateName(name: string) {
  const value = name.trim().replace(/\s+/g, " ");
  if (!value) throw new Error("Name cannot be blank.");
  return value;
}

function throwFriendly(error: { code?: string; message: string }): never {
  if (error.code === "23505") throw new Error("That lead source already exists.");
  throw new Error(error.message);
}
