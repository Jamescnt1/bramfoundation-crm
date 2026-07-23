"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Customer } from "@/components/customers/types";
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import { setTaskStatus } from "@/lib/services/tasks";
import { deleteTaskPermanentlyAction } from "@/app/actions/beta-delete";
import TaskDialog from "./TaskDialog";
import type { TaskType, UniversalTask } from "./types";
import { formatJobDisplayName } from "@/lib/job-display";

type View = "all" | "mine" | "related" | "operations" | "completed";
type Props = { initialTasks: UniversalTask[]; customers: Customer[]; jobs: Job[]; employees: Employee[]; taskTypes: TaskType[]; currentEmployeeId?: string | null; fixedCustomerId?: string | null; fixedJobId?: string | null; compact?: boolean; initialTaskId?: string };

export default function TaskManager({ initialTasks, customers, jobs, employees, taskTypes, currentEmployeeId = null, fixedCustomerId = null, fixedJobId = null, compact = false, initialTaskId }: Props) {
  const [tasks, setTasks] = useState(initialTasks); const [view, setView] = useState<View>(fixedJobId || fixedCustomerId ? "all" : "all");
  const initialTask = initialTaskId ? initialTasks.find((task) => task.id === initialTaskId) ?? null : null;
  const [dialogOpen, setDialogOpen] = useState(Boolean(initialTask)); const [editing, setEditing] = useState<UniversalTask | null>(initialTask); const [error, setError] = useState("");
  const filtered = useMemo(() => tasks.filter((task) => {
    if (fixedJobId && task.job_id !== fixedJobId) return false; if (!fixedJobId && fixedCustomerId && task.customer_id !== fixedCustomerId) return false;
    if (view === "completed") return task.status === "completed"; if (task.status === "completed" || task.status === "cancelled") return false;
    if (view === "mine") return task.assigned_employee_id === currentEmployeeId;
    if (view === "related") return Boolean(task.customer_id || task.job_id);
    if (view === "operations") return ["Office", "Operations", "Inventory", "Accounting", "General", "Personal"].includes(task.task_types?.name ?? "General");
    return true;
  }).sort(sortTasks), [tasks, view, currentEmployeeId, fixedCustomerId, fixedJobId]);

  async function toggle(task: UniversalTask) { const status = task.status === "completed" ? "open" : "completed"; const previous = tasks; setTasks((list) => list.map((item) => item.id === task.id ? { ...item, status, completed: status === "completed" } : item)); try { await setTaskStatus(task.id, status); } catch (caught) { setTasks(previous); setError(message(caught)); } }
  async function remove(task: UniversalTask) { if (!window.confirm(`Permanently delete the task "${task.title}"?\n\nThis beta cleanup action cannot be undone.`)) return; const previous = tasks; setTasks((list) => list.filter((item) => item.id !== task.id)); try { await deleteTaskPermanentlyAction(task.id); } catch (caught) { setTasks(previous); setError(message(caught)); } }
  function saved(task: UniversalTask) { setTasks((list) => list.some((item) => item.id === task.id) ? list.map((item) => item.id === task.id ? task : item) : [task, ...list]); setEditing(null); }

  return <section className={compact ? "" : "mt-8"}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div>{!compact ? <><h2 className="text-xl font-semibold text-gray-950">Tasks</h2><p className="mt-1 text-sm text-gray-500">Customer work and standalone business tasks in one place.</p></> : null}</div><button type="button" onClick={() => { setEditing(null); setDialogOpen(true); }} className="inline-flex w-fit items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"><Plus className="h-4 w-4" /> New Task</button></div>
    {!fixedCustomerId && !fixedJobId ? <div className="mt-5 flex flex-wrap gap-2">{([['all','All'],['mine','My Tasks'],['related','Customer / Job Related'],['operations','Office / Operations'],['completed','Completed']] as const).map(([key, text]) => <button key={key} onClick={() => setView(key)} className={`rounded-lg px-3 py-2 text-sm font-medium ${view === key ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{text}</button>)}</div> : null}
    {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    {filtered.length ? <div className="mt-5 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">{filtered.map((task) => <div key={task.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><input type="checkbox" checked={task.status === "completed"} onChange={() => toggle(task)} className="mt-1 h-4 w-4" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className={`font-medium ${task.status === "completed" ? "text-gray-500 line-through" : "text-gray-950"}`}>{task.title}</p><Badge text={task.task_types?.name ?? "General"} /><Badge text={label(task.priority)} tone={task.priority === "urgent" ? "red" : task.priority === "high" ? "amber" : "gray"} /></div>{task.description ? <p className="mt-1 text-sm text-gray-600">{task.description}</p> : null}<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>{task.employees?.name ?? task.assigned_to ?? "Unassigned"}</span><span>{task.due_at ? new Date(task.due_at).toLocaleString() : "No due date"}</span>{task.customers ? <Link href={`/customers/${task.customers.id}`} className="hover:text-black hover:underline">{task.customers.full_name}</Link> : null}{task.jobs ? <Link href={`/leads/${task.jobs.id}`} className="hover:text-black hover:underline">{formatJobDisplayName({ customerName: task.jobs.customer?.full_name ?? task.customers?.full_name, jobName: task.jobs.customer_name, qfNumber: task.jobs.qfloors_job_number })}</Link> : null}</div></div></div><div className="flex gap-1"><button onClick={() => { setEditing(task); setDialogOpen(true); }} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Edit task"><Pencil className="h-4 w-4" /></button><button onClick={() => remove(task)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Delete task"><Trash2 className="h-4 w-4" /></button></div></div>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">No tasks in this view.</div>}
    <TaskDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }} onSaved={saved} task={editing} customers={customers} jobs={jobs} employees={employees} taskTypes={taskTypes} defaultCustomerId={fixedCustomerId} defaultJobId={fixedJobId} />
  </section>;
}

function Badge({ text, tone = "gray" }: { text: string; tone?: "gray" | "red" | "amber" }) { const colors = { gray: "bg-gray-100 text-gray-600", red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700" }; return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[tone]}`}>{text}</span>; }
function label(value: string) { return value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "); }
function sortTasks(a: UniversalTask, b: UniversalTask) { const priority = { urgent: 0, high: 1, normal: 2, low: 3 }; return priority[a.priority] - priority[b.priority] || (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"); }
function message(error: unknown) { return error instanceof Error ? error.message : "Unable to update task."; }
