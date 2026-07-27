"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Customer } from "@/components/customers/types";
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import { setTaskStatus } from "@/lib/services/tasks";
import { deleteTaskPermanentlyAction } from "@/app/actions/beta-delete";
import { formatJobDisplayName } from "@/lib/job-display";
import TaskDialog from "./TaskDialog";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskNote, type TaskStatus, type TaskType, type UniversalTask } from "./types";

type DueFilter = "all" | "overdue" | "today" | "upcoming" | "no_due";
type StatusFilter = "active" | "all" | TaskStatus;
type Props = {
  initialTasks: UniversalTask[];
  customers: Customer[];
  jobs: Job[];
  employees: Employee[];
  taskTypes: TaskType[];
  currentEmployeeId?: string | null;
  currentEmployeeRole?: string | null;
  fixedCustomerId?: string | null;
  fixedJobId?: string | null;
  compact?: boolean;
  initialTaskId?: string;
  initialNewTask?: boolean;
};

const PAGE_SIZE = 30;

export default function TaskManager({
  initialTasks,
  customers,
  jobs,
  employees,
  taskTypes,
  currentEmployeeId = null,
  currentEmployeeRole = null,
  fixedCustomerId = null,
  fixedJobId = null,
  compact = false,
  initialTaskId,
  initialNewTask = false,
}: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const initialTask = initialTaskId ? initialTasks.find((task) => task.id === initialTaskId) ?? null : null;
  const [dialogOpen, setDialogOpen] = useState(Boolean(initialTask) || initialNewTask);
  const [editing, setEditing] = useState<UniversalTask | null>(initialTask);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [priority, setPriority] = useState("all");
  const [category, setCategory] = useState("all");
  const [due, setDue] = useState<DueFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const resetVisible = () => setVisibleCount(PAGE_SIZE);
  const filtered = useMemo(() => tasks
    .filter((task) => {
      if (fixedJobId && task.job_id !== fixedJobId) return false;
      if (!fixedJobId && fixedCustomerId && task.customer_id !== fixedCustomerId) return false;
      if (status === "active" && (task.status === "completed" || task.status === "cancelled")) return false;
      if (status !== "active" && status !== "all" && task.status !== status) return false;
      if (assignee === "mine" && task.assigned_employee_id !== currentEmployeeId) return false;
      if (assignee !== "all" && assignee !== "mine" && task.assigned_employee_id !== assignee) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (category !== "all" && task.task_type_id !== category) return false;
      if (!matchesDueFilter(task, due)) return false;
      if (search.trim()) {
        const query = search.trim().toLocaleLowerCase();
        const haystack = [
          task.title,
          task.latest_note?.body,
          task.employees?.name,
          task.assigned_to,
          task.customers?.full_name,
          task.jobs?.customer_name,
          task.jobs?.qfloors_job_number,
          task.task_types?.name,
        ].filter(Boolean).join(" ").toLocaleLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort(sortTasks), [
      tasks,
      fixedJobId,
      fixedCustomerId,
      status,
      assignee,
      currentEmployeeId,
      priority,
      category,
      due,
      search,
    ]);

  const visibleTasks = filtered.slice(0, visibleCount);
  const activeFilterCount = [
    assignee !== "all",
    status !== "active",
    priority !== "all",
    category !== "all",
    due !== "all",
    Boolean(search.trim()),
  ].filter(Boolean).length;

  async function toggle(task: UniversalTask) {
    const nextStatus = task.status === "completed" ? "open" : "completed";
    const previous = tasks;
    setTasks((list) => list.map((item) => item.id === task.id
      ? { ...item, status: nextStatus, completed: nextStatus === "completed" }
      : item));
    try {
      await setTaskStatus(task.id, nextStatus);
    } catch (caught) {
      setTasks(previous);
      setError(message(caught));
    }
  }

  async function remove(task: UniversalTask) {
    if (!window.confirm(`Permanently delete the task "${task.title}"?\n\nThis beta cleanup action cannot be undone.`)) return;
    const previous = tasks;
    setTasks((list) => list.filter((item) => item.id !== task.id));
    try {
      await deleteTaskPermanentlyAction(task.id);
    } catch (caught) {
      setTasks(previous);
      setError(message(caught));
    }
  }

  function saved(task: UniversalTask) {
    setTasks((list) => list.some((item) => item.id === task.id)
      ? list.map((item) => item.id === task.id ? task : item)
      : [task, ...list]);
    setEditing(null);
  }

  const latestNoteChanged = useCallback((taskId: string, note: TaskNote | null) => {
    setTasks((list) => list.map((task) => task.id === taskId ? { ...task, latest_note: note } : task));
    setEditing((task) => task?.id === taskId ? { ...task, latest_note: note } : task);
  }, []);

  function resetFilters() {
    setSearch("");
    setAssignee("all");
    setStatus("active");
    setPriority("all");
    setCategory("all");
    setDue("all");
    resetVisible();
  }

  return (
    <section className={compact ? "" : "mt-8"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {!compact ? (
            <>
              <h2 className="text-xl font-semibold text-gray-950">Tasks</h2>
              <p className="mt-1 text-sm text-gray-500">Customer work and standalone business tasks in one place.</p>
            </>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {!fixedCustomerId && !fixedJobId ? (
        <div className="sticky top-0 z-20 mt-5 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_repeat(2,minmax(130px,auto))] xl:grid-cols-[minmax(240px,1fr)_repeat(5,minmax(120px,auto))]">
            <label className="relative">
              <span className="sr-only">Search tasks</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetVisible();
                }}
                placeholder="Search tasks, jobs, notes…"
                className={`${controlClass} pl-9`}
              />
            </label>
            <FilterSelect label="Assignee" value={assignee} onChange={(value) => { setAssignee(value); resetVisible(); }}>
              <option value="all">All assignees</option>
              <option value="mine">My tasks</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Status" value={status} onChange={(value) => { setStatus(value as StatusFilter); resetVisible(); }}>
              <option value="active">Open tasks</option>
              <option value="all">All statuses</option>
              {TASK_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </FilterSelect>
            <FilterSelect label="Priority" value={priority} onChange={(value) => { setPriority(value); resetVisible(); }}>
              <option value="all">All priorities</option>
              {TASK_PRIORITIES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </FilterSelect>
            <FilterSelect label="Category" value={category} onChange={(value) => { setCategory(value); resetVisible(); }}>
              <option value="all">All categories</option>
              {taskTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Due date" value={due} onChange={(value) => { setDue(value as DueFilter); resetVisible(); }}>
              <option value="all">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="upcoming">Upcoming</option>
              <option value="no_due">No due date</option>
            </FilterSelect>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>{filtered.length} {filtered.length === 1 ? "task" : "tasks"} · overdue and due-today work sorts first</span>
            {activeFilterCount ? (
              <button type="button" onClick={resetFilters} className="font-semibold text-gray-700 hover:text-black">
                Reset {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {visibleTasks.length ? (
        <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => void toggle(task)}
              onEdit={() => {
                setEditing(task);
                setDialogOpen(true);
              }}
              onDelete={() => void remove(task)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No tasks match this view.
        </div>
      )}

      {visibleCount < filtered.length ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
          </button>
        </div>
      ) : null}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onSaved={saved}
        task={editing}
        customers={customers}
        jobs={jobs}
        employees={employees}
        taskTypes={taskTypes}
        defaultCustomerId={fixedCustomerId}
        defaultJobId={fixedJobId}
        currentEmployeeId={currentEmployeeId}
        currentEmployeeRole={currentEmployeeRole}
        onLatestNoteChange={latestNoteChanged}
      />
    </section>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: UniversalTask;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dueState = getDueState(task);
  return (
    <article className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-4">
      <div className="flex min-w-0 gap-3">
        <input
          type="checkbox"
          checked={task.status === "completed"}
          onChange={onToggle}
          className="mt-1 h-5 w-5 shrink-0"
          aria-label={`Mark ${task.title} ${task.status === "completed" ? "open" : "completed"}`}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className={`font-medium leading-5 ${task.status === "completed" ? "text-gray-500 line-through" : "text-gray-950"}`}>
              {task.title}
            </h3>
            <StatusBadge status={task.status} />
            <Badge text={label(task.priority)} tone={task.priority === "urgent" ? "red" : task.priority === "high" ? "amber" : "gray"} />
            <Badge text={task.task_types?.name ?? "General"} />
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>{task.employees?.name ?? task.assigned_to ?? "Unassigned"}</span>
            <span className={dueState === "overdue" ? "font-semibold text-red-700" : dueState === "today" ? "font-semibold text-amber-700" : ""}>
              {formatDue(task.due_at)}
            </span>
            {task.customers ? (
              <Link href={`/customers/${task.customers.id}`} className="hover:text-black hover:underline">
                {task.customers.full_name}
              </Link>
            ) : null}
            {task.jobs ? (
              <Link href={`/leads/${task.jobs.id}`} className="hover:text-black hover:underline">
                {formatJobDisplayName({
                  customerName: task.jobs.customer?.full_name ?? task.customers?.full_name,
                  jobName: task.jobs.customer_name,
                  qfNumber: task.jobs.qfloors_job_number,
                })}
              </Link>
            ) : null}
          </div>

          {task.latest_note ? (
            <div className="mt-2 min-w-0 border-l-2 border-gray-200 pl-2.5">
              <p className="text-[11px] font-medium text-gray-500">
                {task.latest_note.author?.name ?? (task.latest_note.source === "legacy_description" ? "Legacy description" : "Former employee")}
                {" · "}
                {formatRelativeDate(task.latest_note.created_at)}
              </p>
              <p className="line-clamp-2 break-words text-sm leading-5 text-gray-600">
                {task.latest_note.body}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="ml-8 flex gap-1 sm:ml-0">
        <button onClick={onEdit} className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100" aria-label="Edit task">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="rounded-lg p-2.5 text-red-600 hover:bg-red-50" aria-label="Delete task">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function FilterSelect({
  label: text,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="sr-only">{text}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={controlClass}>
        {children}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const styles: Record<TaskStatus, string> = {
    open: "bg-blue-50 text-blue-700",
    in_progress: "bg-indigo-50 text-indigo-700",
    waiting: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-gray-100 text-gray-600",
  };
  return <Badge text={label(status)} className={styles[status]} />;
}

function Badge({
  text,
  tone = "gray",
  className,
}: {
  text: string;
  tone?: "gray" | "red" | "amber";
  className?: string;
}) {
  const colors = {
    gray: "bg-gray-100 text-gray-600",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className ?? colors[tone]}`}>
      {text}
    </span>
  );
}

function matchesDueFilter(task: UniversalTask, filter: DueFilter) {
  if (filter === "all") return true;
  const state = getDueState(task);
  if (filter === "no_due") return state === "no_due";
  return state === filter;
}

function getDueState(task: UniversalTask): DueFilter {
  if (!task.due_at) return "no_due";
  const due = new Date(task.due_at);
  const now = new Date();
  if (due < now && task.status !== "completed" && task.status !== "cancelled") return "overdue";
  if (sameLocalDate(due, now)) return "today";
  return "upcoming";
}

function sortTasks(a: UniversalTask, b: UniversalTask) {
  const dueRank: Record<DueFilter, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    no_due: 3,
    all: 4,
  };
  const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 };
  return dueRank[getDueState(a)] - dueRank[getDueState(b)]
    || priorityRank[a.priority] - priorityRank[b.priority]
    || (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999")
    || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function sameLocalDate(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function formatDue(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  if (sameLocalDate(date, today)) return `Today ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameLocalDate(date, yesterday)) return `Yesterday ${time}`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function label(value: string) {
  return value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unable to update task.";
}

const controlClass = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-black focus:ring-2 focus:ring-gray-200";
