import type { PipelineStage } from "@/components/pipeline/constants";
import { supabase } from "@/lib/supabase";

export type AutomationAssignmentType = "job_salesperson" | "specific_employee";
export type AutomationTriggerEvent =
  | "job_created" | "job_status_changed" | "customer_created"
  | "appointment_scheduled" | "appointment_completed" | "task_completed";
export type AutomationActionType = "create_task" | "update_job_status" | "send_email";

export type AutomationEmployee = { id: string; name: string };
export type AutomationRule = {
  id: string; name: string; trigger_event: AutomationTriggerEvent; trigger_value: string | null;
  action_type: AutomationActionType; target_status: PipelineStage | null;
  trigger_status: PipelineStage | null; task_title: string | null; due_offset_days: number;
  assignment_type: AutomationAssignmentType; assigned_employee_id: string | null;
  active: boolean; sort_order: number; created_at: string; updated_at: string;
  employees: AutomationEmployee | AutomationEmployee[] | null;
  email_template_id: string | null;
  email_templates: { id: string; name: string } | { id: string; name: string }[] | null;
};
export type AutomationRuleValues = {
  name: string; trigger_event: AutomationTriggerEvent; trigger_value: string | null;
  action_type: AutomationActionType; target_status: PipelineStage | null;
  task_title: string | null; due_offset_days: number; assignment_type: AutomationAssignmentType;
  assigned_employee_id: string | null; active: boolean;
  email_template_id: string | null;
};

const ruleColumns = `id, name, trigger_event, trigger_value, action_type, target_status,
  trigger_status, task_title, due_offset_days, assignment_type, assigned_employee_id,
  active, sort_order, created_at, updated_at, email_template_id,
  employees (id, name), email_templates (id, name)`;

export async function getAutomationRules(): Promise<AutomationRule[]> {
  const { data, error } = await supabase.from("automation_rules").select(ruleColumns)
    .order("trigger_event").order("trigger_value").order("sort_order").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as AutomationRule[];
}

export async function getAutomationEmployees(): Promise<AutomationEmployee[]> {
  const { data, error } = await supabase.from("employees").select("id, name")
    .eq("active", true).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as AutomationEmployee[];
}

export async function createAutomationRule(values: AutomationRuleValues): Promise<AutomationRule> {
  const sortOrder = await getNextSortOrder(values.trigger_event, values.trigger_value);
  const { data, error } = await supabase.from("automation_rules")
    .insert({ ...normalize(values), sort_order: sortOrder }).select(ruleColumns).single();
  if (error) throw new Error(error.message);
  return data as AutomationRule;
}

export async function updateAutomationRule(ruleId: string, values: AutomationRuleValues): Promise<AutomationRule> {
  const { data, error } = await supabase.from("automation_rules").update(normalize(values))
    .eq("id", ruleId).select(ruleColumns).single();
  if (error) throw new Error(error.message);
  return data as AutomationRule;
}

export async function deleteAutomationRule(ruleId: string) {
  const { error } = await supabase.from("automation_rules").delete().eq("id", ruleId);
  if (error) throw new Error(error.message);
}

export async function setAutomationRuleEnabled(ruleId: string, active: boolean) {
  const { error } = await supabase.from("automation_rules").update({ active }).eq("id", ruleId);
  if (error) throw new Error(error.message);
}

export async function orderAutomationRules(ids: string[]) {
  const results = await Promise.all(ids.map((id, sort_order) =>
    supabase.from("automation_rules").update({ sort_order }).eq("id", id)));
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

async function getNextSortOrder(event: AutomationTriggerEvent, value: string | null) {
  let query = supabase.from("automation_rules").select("sort_order").eq("trigger_event", event);
  query = value ? query.eq("trigger_value", value) : query.is("trigger_value", null);
  const { data, error } = await query.order("sort_order", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

function normalize(values: AutomationRuleValues) {
  return {
    name: values.name.trim(), trigger_event: values.trigger_event,
    trigger_value: values.trigger_value || null,
    trigger_status: values.trigger_event === "job_status_changed" ? values.trigger_value : null,
    action_type: values.action_type,
    target_status: values.action_type === "update_job_status" ? values.target_status : null,
    task_title: values.action_type === "create_task" ? values.task_title?.trim() || null : null,
    due_offset_days: Math.max(0, Math.trunc(values.due_offset_days)),
    assignment_type: values.assignment_type,
    assigned_employee_id: values.action_type === "create_task" && values.assignment_type === "specific_employee"
      ? values.assigned_employee_id : null,
    email_template_id: values.action_type === "send_email" ? values.email_template_id : null,
    active: values.active,
  };
}

export const getTaskAutomationRules = getAutomationRules;
export const createTaskAutomationRule = createAutomationRule;
export const updateTaskAutomationRule = updateAutomationRule;
export const deleteTaskAutomationRule = deleteAutomationRule;
