"use client";

import { type FormEvent, useState } from "react";
import { APPOINTMENT_TYPES } from "@/components/calendar/constants";
import type { PipelineStage, PipelineStageView } from "@/components/pipeline/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AutomationActionType, AutomationAssignmentType, AutomationEmployee, AutomationRule, AutomationRuleValues, AutomationTriggerEvent } from "@/lib/services/task-automation";

type Props = { open: boolean; rule: AutomationRule | null; employees: AutomationEmployee[]; stages: PipelineStageView[];
  emailTemplates: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void; onSave: (values: AutomationRuleValues) => Promise<void> };

export const AUTOMATION_EVENTS: { value: AutomationTriggerEvent; label: string }[] = [
  { value: "job_created", label: "Job / lead is created" },
  { value: "job_status_changed", label: "Job enters a pipeline stage" },
  { value: "customer_created", label: "Customer is created" },
  { value: "appointment_scheduled", label: "Appointment is scheduled" },
  { value: "appointment_completed", label: "Appointment is completed" },
  { value: "task_completed", label: "Task is completed" },
];

export default function AutomationRuleDialog({ open, rule, employees, stages, emailTemplates, onOpenChange, onSave }: Props) {
  const [name, setName] = useState(rule?.name ?? "");
  const [triggerEvent, setTriggerEvent] = useState<AutomationTriggerEvent>(rule?.trigger_event ?? "job_status_changed");
  const [triggerValue, setTriggerValue] = useState(rule?.trigger_value ?? stages[0]?.slug ?? "new_lead");
  const [actionType, setActionType] = useState<AutomationActionType>(rule?.action_type ?? "create_task");
  const [taskTitle, setTaskTitle] = useState(rule?.task_title ?? "");
  const [targetStatus, setTargetStatus] = useState<PipelineStage>(rule?.target_status ?? stages[0]?.slug ?? "new_lead");
  const [dueOffsetDays, setDueOffsetDays] = useState(rule?.due_offset_days ?? 0);
  const [assignmentType, setAssignmentType] = useState<AutomationAssignmentType>(rule?.assignment_type ?? "job_salesperson");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(rule?.assigned_employee_id ?? "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [emailTemplateId, setEmailTemplateId] = useState(rule?.email_template_id ?? "");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  const valueOptions = getTriggerValues(triggerEvent, stages);
  function changeEvent(next: AutomationTriggerEvent) {
    setTriggerEvent(next); setTriggerValue(getTriggerValues(next, stages)[0]?.value ?? "");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || (actionType === "create_task" && !taskTitle.trim()) || (actionType === "send_email" && !emailTemplateId)) { setError("Rule name and action details are required."); return; }
    if (actionType === "create_task" && assignmentType === "specific_employee" && !assignedEmployeeId) { setError("Choose an employee."); return; }
    setSaving(true); setError("");
    try {
      await onSave({ name, trigger_event: triggerEvent, trigger_value: valueOptions.length ? triggerValue : null,
        action_type: actionType, target_status: actionType === "update_job_status" ? targetStatus : null,
        task_title: actionType === "create_task" ? taskTitle : null, due_offset_days: dueOffsetDays,
        assignment_type: assignmentType, assigned_employee_id: assignedEmployeeId || null, active,
        email_template_id: actionType === "send_email" ? emailTemplateId : null });
      onOpenChange(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save rule."); }
    finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><form onSubmit={submit}>
    <DialogHeader><DialogTitle>{rule ? "Edit automation" : "New automation"}</DialogTitle><DialogDescription>Connect activity anywhere in the CRM to a follow-up action.</DialogDescription></DialogHeader>
    <div className="grid gap-5 py-6">
      <Field label="Rule name"><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Schedule measurement moves pipeline" /></Field>
      <Field label="When this happens"><select value={triggerEvent} onChange={(e) => changeEvent(e.target.value as AutomationTriggerEvent)} className={selectClass}>{AUTOMATION_EVENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      {valueOptions.length ? <Field label="Event detail"><select value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} className={selectClass}>{valueOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field> : null}
      <Field label="Then do this"><select value={actionType} onChange={(e) => setActionType(e.target.value as AutomationActionType)} className={selectClass}><option value="create_task">Create a task</option><option value="update_job_status">Update the related job’s pipeline stage</option><option value="send_email">Send a customer email</option></select></Field>
      {actionType === "create_task" ? <>
        <Field label="Task title"><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Follow up with customer" /></Field>
        <Field label="Due timing"><div className="flex items-center gap-3"><Input type="number" min={0} value={dueOffsetDays} onChange={(e) => setDueOffsetDays(Math.max(0, Number(e.target.value) || 0))} className="max-w-28"/><span className="text-sm text-gray-600">{dueOffsetDays ? `${dueOffsetDays} day(s) later` : "Immediately"}</span></div></Field>
        <Field label="Assign task to"><select value={assignmentType} onChange={(e) => setAssignmentType(e.target.value as AutomationAssignmentType)} className={selectClass}><option value="job_salesperson">Related job salesperson / event employee</option><option value="specific_employee">Specific employee</option></select></Field>
        {assignmentType === "specific_employee" ? <Field label="Employee"><select value={assignedEmployeeId} onChange={(e) => setAssignedEmployeeId(e.target.value)} className={selectClass}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></Field> : null}
      </> : actionType === "update_job_status" ? <Field label="Move related job to"><select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value as PipelineStage)} className={selectClass}>{stages.map((stage) => <option key={stage.slug} value={stage.slug}>{stage.label}</option>)}</select></Field> : <Field label="Email template"><select value={emailTemplateId} onChange={(e) => setEmailTemplateId(e.target.value)} className={selectClass}><option value="">Choose a template</option>{emailTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>}
      <label className="flex items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/><span><strong className="block">Rule enabled</strong><span className="text-sm text-gray-500">Disabled rules remain saved but do not run.</span></span></label>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button><Button disabled={saving}>{saving ? "Saving..." : "Save automation"}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function getTriggerValues(event: AutomationTriggerEvent, stages: PipelineStageView[]) {
  if (event === "job_status_changed") return stages.map((stage) => ({ value: stage.slug, label: stage.label }));
  if (event === "appointment_scheduled" || event === "appointment_completed") return APPOINTMENT_TYPES.map((value) => ({ value, label: title(value) }));
  return [];
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium text-gray-800"><span>{label}</span>{children}</label>; }
function title(value: string) { return value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "); }
const selectClass = "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm";
