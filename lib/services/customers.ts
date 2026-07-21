import type { Customer } from "@/components/customers/types";
import { supabase } from "@/lib/supabase";

export type CustomerValues = {
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export async function getCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .is("archived_at", null)
    .order("full_name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Customer[];
}

export async function getCustomerById(
  customerId: string,
) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .is("archived_at", null)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Customer;
}

export async function createCustomer(
  values: CustomerValues,
) {
  const { data, error } = await supabase
    .from("customers")
    .insert(values)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Customer;
}

export async function updateCustomer(
  customerId: string,
  values: CustomerValues,
) {
  const { data, error } = await supabase
    .from("customers")
    .update(values)
    .eq("id", customerId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Customer;
}
