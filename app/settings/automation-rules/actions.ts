"use server";

import { revalidatePath } from "next/cache";
import type {
  AutomationRule,
  AutomationRuleValues,
} from "@/lib/services/task-automation";
import { requirePermission } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

const ruleColumns = `id, name, trigger_event, trigger_value, action_type, target_status,
  trigger_status, task_title, task_priority, task_type_id, due_offset_days, assignment_type, assigned_employee_id,
  cancel_on_pipeline_advance, active, sort_order, created_at, updated_at, email_template_id,
  employees (id, name), email_templates (id, name), task_types (id, name),
  automation_rule_recipients (id, recipient_type, employee_id, role_key)`;

export async function createAutomationRuleAction(values: AutomationRuleValues) {
  await requirePermission("automations.manage");
  validate(values);
  const admin = createAdminClient();
  const sortOrder = await nextSortOrder(
    values.trigger_event,
    values.trigger_value,
  );
  const { data, error } = await admin
    .from("automation_rules")
    .insert({ ...normalize(values), sort_order: sortOrder })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  try {
    await replaceRecipients(data.id, values.employee_ids, values.role_keys);
    return await loadRule(data.id);
  } catch (error) {
    await admin.from("automation_rules").delete().eq("id", data.id);
    throw error;
  }
}

export async function updateAutomationRuleAction(
  ruleId: string,
  values: AutomationRuleValues,
) {
  await requirePermission("automations.manage");
  validate(values);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("automation_rules")
    .update(normalize(values))
    .eq("id", ruleId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The automation rule was not updated.");
  await replaceRecipients(ruleId, values.employee_ids, values.role_keys);
  return await loadRule(ruleId);
}

export async function deleteAutomationRuleAction(ruleId: string) {
  await requirePermission("automations.manage");
  const { data, error } = await createAdminClient()
    .from("automation_rules")
    .delete()
    .eq("id", ruleId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The automation rule was not deleted.");
  refresh();
}

export async function setAutomationRuleEnabledAction(
  ruleId: string,
  active: boolean,
) {
  await requirePermission("automations.manage");
  const { error } = await createAdminClient()
    .from("automation_rules")
    .update({ active })
    .eq("id", ruleId);
  if (error) throw new Error(error.message);
  refresh();
}

export async function orderAutomationRulesAction(ids: string[]) {
  await requirePermission("automations.manage");
  const admin = createAdminClient();
  for (const [sort_order, id] of ids.entries()) {
    const { error } = await admin
      .from("automation_rules")
      .update({ sort_order })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
  refresh();
}

async function replaceRecipients(
  ruleId: string,
  employeeIds: string[],
  roleKeys: string[],
) {
  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("automation_rule_recipients")
    .delete()
    .eq("automation_rule_id", ruleId);
  if (deleteError) throw new Error(deleteError.message);

  const recipients: {
    automation_rule_id: string;
    recipient_type: "employee" | "role";
    employee_id: string | null;
    role_key: string | null;
  }[] = [
    ...[...new Set(employeeIds.filter(Boolean))].map((employee_id) => ({
      automation_rule_id: ruleId,
      recipient_type: "employee" as const,
      employee_id,
      role_key: null,
    })),
    ...[...new Set(roleKeys.filter(Boolean))].map((role_key) => ({
      automation_rule_id: ruleId,
      recipient_type: "role" as const,
      role_key,
      employee_id: null,
    })),
  ];
  if (!recipients.length) return;
  const { error } = await admin
    .from("automation_rule_recipients")
    .insert(recipients);
  if (error) throw new Error(error.message);
}

async function loadRule(ruleId: string) {
  const { data, error } = await createAdminClient()
    .from("automation_rules")
    .select(ruleColumns)
    .eq("id", ruleId)
    .single();
  if (error) throw new Error(error.message);
  refresh();
  return data as AutomationRule;
}

async function nextSortOrder(event: string, value: string | null) {
  let query = createAdminClient()
    .from("automation_rules")
    .select("sort_order")
    .eq("trigger_event", event);
  query = value
    ? query.eq("trigger_value", value)
    : query.is("trigger_value", null);
  const { data, error } = await query
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

function validate(values: AutomationRuleValues) {
  if (!values.name.trim()) throw new Error("Rule name is required.");
  if (values.action_type === "create_task") {
    if (!values.task_title?.trim()) throw new Error("Task title is required.");
    if (
      values.assignment_type === "specific_employee" &&
      !values.employee_ids.length &&
      !values.role_keys.length
    ) {
      throw new Error("Select at least one employee or role.");
    }
  }
  if (values.action_type === "send_email" && !values.email_template_id) {
    throw new Error("Choose an email template.");
  }
  if (values.action_type === "update_job_status" && !values.target_status) {
    throw new Error("Choose a pipeline stage.");
  }
}

function normalize(values: AutomationRuleValues) {
  const firstEmployee = values.employee_ids[0] ?? null;
  return {
    name: values.name.trim(),
    trigger_event: values.trigger_event,
    trigger_value: values.trigger_value || null,
    trigger_status:
      values.trigger_event === "job_status_changed"
        ? values.trigger_value
        : null,
    action_type: values.action_type,
    target_status:
      values.action_type === "update_job_status"
        ? values.target_status
        : null,
    task_title:
      values.action_type === "create_task"
        ? values.task_title?.trim() || null
        : null,
    task_priority:
      values.action_type === "create_task" ? values.task_priority : "normal",
    task_type_id:
      values.action_type === "create_task" ? values.task_type_id : null,
    due_offset_days: Math.max(0, Math.trunc(values.due_offset_days)),
    assignment_type: values.assignment_type,
    assigned_employee_id:
      values.action_type === "create_task" &&
      values.assignment_type === "specific_employee"
        ? firstEmployee
        : null,
    cancel_on_pipeline_advance:
      values.action_type === "create_task" &&
      values.cancel_on_pipeline_advance,
    email_template_id:
      values.action_type === "send_email"
        ? values.email_template_id
        : null,
    active: values.active,
  };
}

function refresh() {
  revalidatePath("/settings/automation-rules");
  revalidatePath("/tasks");
  revalidatePath("/company");
  revalidatePath("/my-dashboard");
}
