"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee } from "@/lib/services/employees";
import { createClient } from "@/lib/supabase/server";

export type CreateLeadInput = {
  customerMode: "existing" | "new";
  customerId: string;
  newCustomer: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  job: {
    name: string;
    phone: string;
    email: string;
    address: string;
    leadSource: string;
    salesperson: string;
    nextAction: string;
    nextActionDue: string;
    notes: string;
  };
};

export async function createLeadAction(input: CreateLeadInput) {
  await requireEmployee();
  const supabase = await createClient();
  const jobName = cleanRequired(input.job.name, "Project / lead name is required.");
  let customerId = input.customerId.trim();
  let createdCustomerId: string | null = null;

  if (input.customerMode === "new") {
    const customerName = cleanRequired(input.newCustomer.name, "Customer name is required.");
    const { data, error } = await supabase
      .from("customers")
      .insert({
        full_name: customerName,
        phone: clean(input.newCustomer.phone),
        email: clean(input.newCustomer.email),
        address: clean(input.newCustomer.address),
        notes: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    customerId = data.id;
    createdCustomerId = data.id;
  }

  if (!customerId) throw new Error("Please select the existing customer for this job.");

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, phone, email, address")
    .eq("id", customerId)
    .is("archived_at", null)
    .single();
  if (customerError) throw new Error("The selected customer is unavailable.");

  const leadSource = clean(input.job.leadSource);
  if (leadSource) {
    const { data: validSource, error: sourceError } = await supabase
      .from("lead_sources")
      .select("id")
      .eq("name", leadSource)
      .eq("active", true)
      .maybeSingle();
    if (sourceError) throw new Error(sourceError.message);
    if (!validSource) throw new Error("Select an active lead source.");
  }

  const salesperson = clean(input.job.salesperson);
  let assignedEmployeeId: string | null = null;
  if (salesperson) {
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("name", salesperson)
      .eq("active", true)
      .maybeSingle();
    if (employeeError) throw new Error(employeeError.message);
    assignedEmployeeId = employee?.id ?? null;
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      customer_id: customerId,
      assigned_employee_id: assignedEmployeeId,
      customer_name: jobName,
      phone: clean(input.job.phone) ?? customer.phone,
      email: clean(input.job.email) ?? customer.email,
      address: clean(input.job.address) ?? customer.address,
      lead_source: leadSource,
      salesperson,
      status: "New Lead",
      next_action: clean(input.job.nextAction),
      next_action_due: clean(input.job.nextActionDue),
      notes: clean(input.job.notes),
    })
    .select("id")
    .single();

  if (jobError) {
    if (createdCustomerId) {
      await supabase.from("customers").delete().eq("id", createdCustomerId);
    }
    throw new Error(jobError.message);
  }

  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");
  revalidatePath("/my-dashboard");
  return { id: job.id };
}

function clean(value: string) {
  return value.trim() || null;
}

function cleanRequired(value: string, message: string) {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(message);
  return cleaned;
}
