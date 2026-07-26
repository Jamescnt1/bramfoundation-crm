"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee, requirePermission } from "@/lib/services/employees";
import { createClient } from "@/lib/supabase/server";
import type { CustomerContactValues } from "@/lib/services/customer-contacts";

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

function payload(values: CustomerContactValues) {
  const firstName = values.first_name.trim();
  if (!firstName) throw new Error("First name is required.");
  if (!values.customer_id) throw new Error("Parent customer is required.");
  return {
    customer_id: values.customer_id,
    first_name: firstName,
    last_name: clean(values.last_name) ?? "",
    job_title: clean(values.job_title),
    email: clean(values.email),
    office_phone: clean(values.office_phone),
    mobile_phone: clean(values.mobile_phone),
    notes: clean(values.notes),
    active: values.active ?? true,
  };
}

function refresh(customerId: string) {
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/leads");
}

export async function createCustomerContactAction(values: CustomerContactValues) {
  await requirePermission("customers.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_contacts")
    .insert(payload(values))
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  refresh(values.customer_id);
  return data;
}

export async function updateCustomerContactAction(
  contactId: string,
  values: CustomerContactValues,
) {
  await requirePermission("customers.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_contacts")
    .update(payload(values))
    .eq("id", contactId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  refresh(values.customer_id);
  revalidatePath(`/leads`);
  return data;
}

export async function archiveCustomerContactAction(contactId: string) {
  await requirePermission("delete_customers");
  const employee = await requireEmployee();
  const supabase = await createClient();
  const { data: contact, error: loadError } = await supabase
    .from("customer_contacts")
    .select("customer_id")
    .eq("id", contactId)
    .single();
  if (loadError) throw new Error(loadError.message);
  const { error } = await supabase
    .from("customer_contacts")
    .update({ active: false, archived_at: new Date().toISOString(), archived_by: employee.id })
    .eq("id", contactId);
  if (error) throw new Error(error.message);
  refresh(contact.customer_id);
}
