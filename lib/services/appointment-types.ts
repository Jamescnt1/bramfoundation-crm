import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AppointmentTypeDefinition = {
  key: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export async function getAppointmentTypes({
  includeInactive = false,
}: {
  includeInactive?: boolean;
} = {}): Promise<AppointmentTypeDefinition[]> {
  const supabase = await createClient();
  let query = supabase
    .from("appointment_types")
    .select("key, name, active, sort_order")
    .order("sort_order")
    .order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AppointmentTypeDefinition[];
}

export async function createAppointmentType(name: string) {
  const supabase = createAdminClient();
  const normalizedName = validateName(name);
  const baseKey = slugify(normalizedName);
  const { data: existingKeys, error: keyError } = await supabase
    .from("appointment_types")
    .select("key")
    .like("key", `${baseKey}%`);
  if (keyError) throw new Error(keyError.message);

  const usedKeys = new Set((existingKeys ?? []).map((item) => item.key));
  let key = baseKey;
  let suffix = 2;
  while (usedKeys.has(key)) {
    key = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  const { data: last, error: orderError } = await supabase
    .from("appointment_types")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);

  const { error } = await supabase.from("appointment_types").insert({
    key,
    name: normalizedName,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) throwFriendly(error);
}

export async function updateAppointmentType(
  key: string,
  values: Pick<AppointmentTypeDefinition, "name" | "active" | "sort_order">,
) {
  if (
    (key === "appointment" || key === "installation") &&
    !values.active
  ) {
    throw new Error("This system appointment type must remain active.");
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("appointment_types")
    .update({
      name: validateName(values.name),
      active: values.active,
      sort_order: values.sort_order,
    })
    .eq("key", key);
  if (error) throwFriendly(error);
}

export async function removeAppointmentType(
  key: string,
): Promise<"deleted" | "retired"> {
  if (key === "appointment" || key === "installation") {
    throw new Error("This system appointment type cannot be removed.");
  }
  const supabase = createAdminClient();
  const { count, error: countError } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("appointment_type", key);
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("appointment_types")
      .update({ active: false })
      .eq("key", key);
    if (error) throw new Error(error.message);
    return "retired";
  }

  const { error } = await supabase
    .from("appointment_types")
    .delete()
    .eq("key", key);
  if (error) throw new Error(error.message);
  return "deleted";
}

function validateName(name: string) {
  const value = name.trim().replace(/\s+/g, " ");
  if (!value) throw new Error("Appointment type name cannot be blank.");
  if (value.length > 80) {
    throw new Error("Appointment type names must be 80 characters or fewer.");
  }
  return value;
}

function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56);
  return slug && /^[a-z]/.test(slug) ? slug : `type_${slug || "custom"}`;
}

function throwFriendly(error: { code?: string; message: string }): never {
  if (error.code === "23505") {
    throw new Error("That appointment type already exists.");
  }
  throw new Error(error.message);
}
