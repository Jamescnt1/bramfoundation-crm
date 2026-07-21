"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/components/customers/types";
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import { createTask, updateTask, type TaskValues } from "@/lib/services/tasks";
import { formatJobDisplayName } from "@/lib/job-display";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus, type TaskType, type UniversalTask } from "./types";

type Props = {
  open: boolean; onOpenChange: (open: boolean) => void; onSaved: (task: UniversalTask) => void;
  task?: UniversalTask | null; customers: Customer[]; jobs: Job[]; employees: Employee[]; taskTypes: TaskType[];
  defaultCustomerId?: string | null; defaultJobId?: string | null;
};

export default function TaskDialog({ open, onOpenChange, onSaved, task, customers, jobs, employees, taskTypes, defaultCustomerId = null, defaultJobId = null }: Props) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {open ? <TaskDialogForm key={`${task?.id ?? "new"}-${defaultCustomerId ?? ""}-${defaultJobId ?? ""}`} onOpenChange={onOpenChange} onSaved={onSaved} task={task} customers={customers} jobs={jobs} employees={employees} taskTypes={taskTypes} defaultCustomerId={defaultCustomerId} defaultJobId={defaultJobId} /> : null}
  </Dialog>;
}

function TaskDialogForm({ onOpenChange, onSaved, task, customers, jobs, employees, taskTypes, defaultCustomerId, defaultJobId }: Omit<Props, "open">) {
  const selectedDefaultJob = jobs.find((job) => job.id === (task?.job_id ?? defaultJobId));
  const [title, setTitle] = useState(task?.title ?? ""); const [description, setDescription] = useState(task?.description ?? "");
  const [employeeId, setEmployeeId] = useState(task?.assigned_employee_id ?? ""); const [dueAt, setDueAt] = useState(toLocalInput(task?.due_at));
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "normal"); const [status, setStatus] = useState<TaskStatus>(task?.status ?? "open");
  const [taskTypeId, setTaskTypeId] = useState(task?.task_type_id ?? taskTypes[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(task?.customer_id ?? selectedDefaultJob?.customer_id ?? defaultCustomerId ?? "");
  const [jobId, setJobId] = useState(task?.job_id ?? defaultJobId ?? "");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  const availableJobs = useMemo(() => customerId ? jobs.filter((job) => job.customer_id === customerId) : jobs, [customerId, jobs]);

  function selectCustomer(value: string) { setCustomerId(value); if (jobId && jobs.find((job) => job.id === jobId)?.customer_id !== value) setJobId(""); }
  function selectJob(value: string) { setJobId(value); const job = jobs.find((item) => item.id === value); if (job?.customer_id) setCustomerId(job.customer_id); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const selectedJob = jobs.find((job) => job.id === jobId);
    if (jobId && customerId && selectedJob?.customer_id !== customerId) { setError("The selected job does not belong to the selected customer."); setSaving(false); return; }
    const values: TaskValues = { title, description: description || null, assigned_employee_id: employeeId || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null, priority, status, task_type_id: taskTypeId || null,
      customer_id: customerId || selectedJob?.customer_id || null, job_id: jobId || null };
    try { const saved = task ? await updateTask(task.id, values) : await createTask(values); onSaved(saved); onOpenChange(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save task."); }
    finally { setSaving(false); }
  }

  return <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
    <form onSubmit={submit}><DialogHeader><DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle><DialogDescription>Customer and job relationships are optional. Use this form for customer work or general business tasks.</DialogDescription></DialogHeader>
    <div className="grid gap-5 py-6">
      <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Run to Costco for coffee and water" /></Field>
      <Field label="Description / notes"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} placeholder="Add details or instructions..." /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Assigned employee"><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}><option value="">Unassigned</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></Field>
      <Field label="Due date and time"><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-3"><Field label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputClass}>{TASK_PRIORITIES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Field>
      <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputClass}>{TASK_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Field>
      <Field label="Category / type"><select value={taskTypeId} onChange={(e) => setTaskTypeId(e.target.value)} className={inputClass}><option value="">General</option>{taskTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Related customer (optional)"><select value={customerId} onChange={(e) => selectCustomer(e.target.value)} className={inputClass}><option value="">No customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}</select></Field>
      <Field label="Related job (optional)"><select value={jobId} onChange={(e) => selectJob(e.target.value)} className={inputClass}><option value="">No job</option>{availableJobs.map((job) => <option key={job.id} value={job.id}>{formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}</option>)}</select></Field></div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : task ? "Save changes" : "Create task"}</Button></DialogFooter></form>
  </DialogContent>;
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium text-gray-700"><span>{text}</span>{children}</label>; }
const inputClass = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200";
function label(value: string) { return value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "); }
function toLocalInput(value?: string | null) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
