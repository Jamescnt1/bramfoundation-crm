"use client";

import { type FormEvent, useState } from "react";
import type { PipelineStage, PipelineStageView } from "@/components/pipeline/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AutomationActionType, AutomationAssignmentType, AutomationEmployee, AutomationRole, AutomationRule, AutomationRuleValues, AutomationTriggerEvent } from "@/lib/services/task-automation";
import type { AppointmentTypeDefinition } from "@/lib/services/appointment-types";
import type { TaskType } from "@/components/tasks/types";

type Props = { open: boolean; rule: AutomationRule | null; employees: AutomationEmployee[]; roles: AutomationRole[]; stages: PipelineStageView[];
  emailTemplates: { id: string; name: string }[];
  appointmentTypes: AppointmentTypeDefinition[];
  taskTypes: TaskType[];
  onOpenChange: (open: boolean) => void; onSave: (values: AutomationRuleValues) => Promise<void> };

export const AUTOMATION_EVENTS: { value: AutomationTriggerEvent; label: string }[] = [
  { value: "job_created", label: "Job / lead is created" },
  { value: "job_status_changed", label: "Job enters a pipeline stage" },
  { value: "customer_created", label: "Customer is created" },
  { value: "appointment_scheduled", label: "Appointment is scheduled" },
  { value: "appointment_completed", label: "Appointment is completed" },
  { value: "task_completed", label: "Task is completed" },
  { value: "lead_untouched_daily", label: "Lead has been untouched for 24 hours" },
  { value: "production_scope_created", label: "A production scope is created" },
  { value: "material_issue", label: "A production issue is reported" },
  { value: "material_ordered", label: "A material is ordered" },
  { value: "material_ready", label: "A material is ready" },
  { value: "material_excluded", label: "A material requirement is excluded" },
  { value: "all_materials_ordered", label: "All required materials are ordered" },
  { value: "all_materials_ready", label: "All required materials are ready" },
  { value: "work_order_sent", label: "A crew work order is sent" },
  { value: "all_work_orders_sent", label: "All required work orders are sent" },
];

export default function AutomationRuleDialog({ open, rule, employees, roles, stages, emailTemplates, appointmentTypes, taskTypes, onOpenChange, onSave }: Props) {
  const [name, setName] = useState(rule?.name ?? "");
  const [triggerEvent, setTriggerEvent] = useState<AutomationTriggerEvent>(rule?.trigger_event ?? "job_status_changed");
  const [triggerValue, setTriggerValue] = useState(rule?.trigger_value ?? stages[0]?.slug ?? "new_lead");
  const [actionType, setActionType] = useState<AutomationActionType>(rule?.action_type ?? "create_task");
  const [taskTitle, setTaskTitle] = useState(rule?.task_title ?? "");
  const [taskPriority, setTaskPriority] = useState<"low" | "normal" | "high" | "urgent">(rule?.task_priority ?? "normal");
  const [taskTypeId, setTaskTypeId] = useState(rule?.task_type_id ?? "");
  const [targetStatus, setTargetStatus] = useState<PipelineStage>(rule?.target_status ?? stages[0]?.slug ?? "new_lead");
  const [dueOffsetDays, setDueOffsetDays] = useState(rule?.due_offset_days ?? 0);
  const [deliveryOffsetDays, setDeliveryOffsetDays] = useState(rule?.delivery_offset_days ?? 0);
  const [overdueGraceDays, setOverdueGraceDays] = useState(rule?.overdue_grace_days ?? 1);
  const [assignmentType, setAssignmentType] = useState<AutomationAssignmentType>(rule?.assignment_type ?? "job_salesperson");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(rule?.assigned_employee_id ?? "");
  const [employeeIds, setEmployeeIds] = useState<string[]>(() => {
    const ids = (rule?.automation_rule_recipients ?? [])
      .filter((recipient) => recipient.recipient_type === "employee")
      .map((recipient) => recipient.employee_id)
      .filter((id): id is string => Boolean(id));
    if (!ids.length && rule?.assigned_employee_id) ids.push(rule.assigned_employee_id);
    return ids;
  });
  const [roleKeys, setRoleKeys] = useState<string[]>(() =>
    (rule?.automation_rule_recipients ?? [])
      .filter((recipient) => recipient.recipient_type === "role")
      .map((recipient) => recipient.role_key)
      .filter((key): key is string => Boolean(key)),
  );
  const [cancelOnPipelineAdvance, setCancelOnPipelineAdvance] = useState(
    rule?.cancel_on_pipeline_advance ?? true,
  );
  const [active, setActive] = useState(rule?.active ?? true);
  const [emailTemplateId, setEmailTemplateId] = useState(rule?.email_template_id ?? "");
  const [notificationAudience, setNotificationAudience] = useState<"customer" | "employee" | "installer">(rule?.notification_audience ?? "installer");
  const [notificationChannel, setNotificationChannel] = useState<"email" | "sms">(rule?.notification_channel ?? "sms");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  const valueOptions = getTriggerValues(triggerEvent, stages, appointmentTypes);
  function changeEvent(next: AutomationTriggerEvent) {
    setTriggerEvent(next); setTriggerValue(getTriggerValues(next, stages, appointmentTypes)[0]?.value ?? "");
    if (next !== "appointment_scheduled" && actionType === "send_notification") setActionType("create_task");
    if (!rule) setCancelOnPipelineAdvance(next === "job_status_changed");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || (actionType === "create_task" && !taskTitle.trim()) || (actionType === "send_email" && !emailTemplateId)) { setError("Rule name and action details are required."); return; }
    if (actionType === "create_task" && assignmentType === "specific_employee" && !employeeIds.length && !roleKeys.length) { setError("Choose at least one employee or role."); return; }
    setSaving(true); setError("");
    try {
      await onSave({ name, trigger_event: triggerEvent, trigger_value: valueOptions.length ? triggerValue : null,
        action_type: actionType, target_status: actionType === "update_job_status" ? targetStatus : null,
        task_title: actionType === "create_task" ? taskTitle : null, task_priority: taskPriority, task_type_id: taskTypeId || null, delivery_offset_days: deliveryOffsetDays, due_offset_days: dueOffsetDays, overdue_grace_days: overdueGraceDays,
        assignment_type: assignmentType, assigned_employee_id: assignedEmployeeId || null, active,
        cancel_on_pipeline_advance: cancelOnPipelineAdvance,
        email_template_id: actionType === "send_email" ? emailTemplateId : null,
        notification_audience: actionType === "send_notification" ? notificationAudience : null,
        notification_channel: actionType === "send_notification" ? notificationChannel : null,
        employee_ids: assignmentType === "specific_employee" ? employeeIds : [],
        role_keys: assignmentType === "specific_employee" ? roleKeys : [] });
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
      <Field label="Then do this"><select value={actionType} onChange={(e) => setActionType(e.target.value as AutomationActionType)} className={selectClass}><option value="create_task">Create a task</option><option value="update_job_status">Update the related job’s pipeline stage</option><option value="send_email">Send a customer email</option>{triggerEvent === "appointment_scheduled" ? <option value="send_notification">Send an appointment notification</option> : null}</select></Field>
      {actionType === "create_task" ? <>
        <Field label="Task title"><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Follow up with customer" /></Field>
        {triggerEvent === "material_issue" ? <span className="-mt-3 text-xs text-gray-500">Use <code>{"{{issue}}"}</code> to include the reported issue in the task title.</span> : null}
        <Field label="Task priority"><select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as typeof taskPriority)} className={selectClass}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field>
        <Field label="Task category"><select value={taskTypeId} onChange={(e) => setTaskTypeId(e.target.value)} className={selectClass}><option value="">General</option>{taskTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><span className="text-xs font-normal text-gray-500">Generated tasks will appear under this category.</span></Field>
        <Field label="Send task"><div className="flex items-center gap-3"><Input type="number" min={0} max={365} value={deliveryOffsetDays} onChange={(e) => setDeliveryOffsetDays(Math.min(365, Math.max(0, Number(e.target.value) || 0)))} className="max-w-28"/><span className="text-sm text-gray-600">{deliveryOffsetDays ? `${deliveryOffsetDays} day(s) after the action` : "Immediately"}</span></div><span className="text-xs font-normal text-gray-500">Until this date, the reminder stays out of employee task lists, job history, search, reports, and manager warnings.</span></Field>
        <Field label="Task due after delivery"><div className="flex items-center gap-3"><Input type="number" min={0} max={365} value={dueOffsetDays} onChange={(e) => setDueOffsetDays(Math.min(365, Math.max(0, Number(e.target.value) || 0)))} className="max-w-28"/><span className="text-sm text-gray-600">{dueOffsetDays ? `${dueOffsetDays} day(s) after delivery` : "When delivered"}</span></div><span className="text-xs font-normal text-gray-500">The due and manager-accountability clocks begin from the delivery date.</span></Field>
        <Field label="Manager overdue warning after"><div className="flex items-center gap-3"><Input type="number" min={0} max={365} value={overdueGraceDays} onChange={(e) => setOverdueGraceDays(Math.min(365, Math.max(0, Number(e.target.value) || 0)))} className="max-w-28"/><span className="text-sm text-gray-600">{overdueGraceDays ? `${overdueGraceDays} day(s) after due` : "Immediately when due"}</span></div><span className="text-xs font-normal text-gray-500">Controls when this task appears as overdue on the Company Dashboard. It does not delay or hide the employee’s task.</span></Field>
        <Field label="Assign task to"><select value={assignmentType} onChange={(e) => setAssignmentType(e.target.value as AutomationAssignmentType)} className={selectClass}><option value="job_salesperson">Related job salesperson / event employee</option><option value="specific_employee">Specific employee</option></select></Field>
        {assignmentType === "specific_employee" ? <Field label="Recipients"><div className="grid gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2"><RecipientGroup label="Employees" options={employees.map((employee) => ({ value: employee.id, label: employee.name }))} selected={employeeIds} onChange={(next) => { setEmployeeIds(next); setAssignedEmployeeId(next[0] ?? ""); }} /><RecipientGroup label="Roles" options={roles.map((role) => ({ value: role.key, label: role.name }))} selected={roleKeys} onChange={setRoleKeys} /></div><span className="text-xs font-normal text-gray-500">Role membership is resolved when the automation runs. Duplicate employees receive only one task.</span></Field> : null}
      </> : actionType === "update_job_status" ? <Field label="Move related job to"><select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value as PipelineStage)} className={selectClass}>{stages.map((stage) => <option key={stage.slug} value={stage.slug}>{stage.label}</option>)}</select></Field> : actionType === "send_email" ? <Field label="Email template"><select value={emailTemplateId} onChange={(e) => setEmailTemplateId(e.target.value)} className={selectClass}><option value="">Choose a template</option>{emailTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field> : <div className="grid gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-2"><Field label="Notify"><select value={notificationAudience} onChange={(e) => setNotificationAudience(e.target.value as typeof notificationAudience)} className={selectClass}><option value="installer">Assigned installer crew</option><option value="employee">Assigned employee</option><option value="customer">Project/customer contact</option></select></Field><Field label="Using"><select value={notificationChannel} onChange={(e) => setNotificationChannel(e.target.value as typeof notificationChannel)} className={selectClass}><option value="sms">Text message</option><option value="email">Email</option></select></Field><p className="text-xs text-blue-800 sm:col-span-2">Uses the appointment date and time automatically. Company safety controls, individual preferences, and SMS consent still take priority.</p></div>}
      <label className={`flex items-start gap-3 rounded-lg border p-3 ${actionType !== "create_task" ? "bg-gray-50 opacity-60" : ""}`}><input type="checkbox" checked={cancelOnPipelineAdvance} onChange={(e) => setCancelOnPipelineAdvance(e.target.checked)} disabled={actionType !== "create_task"} className="mt-1"/><span><strong className="block">Override this task when advanced in pipeline</strong><span className="text-sm text-gray-500">Cancel unfinished tasks created by this automation after the job moves to a later pipeline stage.</span></span></label>
      <label className="flex items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/><span><strong className="block">Rule enabled</strong><span className="text-sm text-gray-500">Disabled rules remain saved but do not run.</span></span></label>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save automation"}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function getTriggerValues(event: AutomationTriggerEvent, stages: PipelineStageView[], appointmentTypes: AppointmentTypeDefinition[]) {
  if (event === "job_status_changed") return stages.map((stage) => ({ value: stage.slug, label: stage.label }));
  if (event === "appointment_scheduled" || event === "appointment_completed") return appointmentTypes.map((type) => ({ value: type.key, label: type.name }));
  return [];
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium text-gray-800"><span>{label}</span>{children}</label>; }
function RecipientGroup({ label, options, selected, onChange }: { label: string; options: { value: string; label: string }[]; selected: string[]; onChange: (selected: string[]) => void }) {
  return <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</legend><div className="max-h-44 space-y-1 overflow-y-auto">{options.map((option) => <label key={option.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-gray-50"><input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))} />{option.label}</label>)}</div></fieldset>;
}
const selectClass = "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm";
