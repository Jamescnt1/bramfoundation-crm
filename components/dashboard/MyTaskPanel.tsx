"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { updateMyDashboardTaskStatus } from "@/app/my-dashboard/actions";
import {
  TASK_STATUSES,
  type TaskStatus,
} from "@/components/tasks/types";
import type { WorkspaceTask } from "@/lib/services/workspace";
import { formatJobDisplayName } from "@/lib/job-display";
import { dateKeyInTimeZone, formatTaskDue } from "@/lib/date-time";

type Props = {
  initialTasks: WorkspaceTask[];
  timeZone: string;
};

type DueGroup = "Overdue" | "Due Today" | "Upcoming" | "No Due Date";

const groupOrder: DueGroup[] = ["Overdue", "Due Today", "Upcoming", "No Due Date"];

export default function MyTaskPanel({ initialTasks, timeZone }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const grouped = useMemo(() => {
    const result: Record<DueGroup, WorkspaceTask[]> = {
      Overdue: [],
      "Due Today": [],
      Upcoming: [],
      "No Due Date": [],
    };
    const today = dateKeyInTimeZone(new Date(), timeZone);
    for (const task of tasks.filter(isOpenTask).sort((a, b) => compareTasks(a, b, timeZone))) {
      result[getDueGroup(task, today, timeZone)].push(task);
    }
    return result;
  }, [tasks, timeZone]);

  const taskCount = groupOrder.reduce((count, group) => count + grouped[group].length, 0);

  async function changeStatus(task: WorkspaceTask, status: TaskStatus) {
    const previous = tasks;
    setError("");
    setSavingId(task.id);
    setTasks((items) => items
      .map((item) => item.id === task.id
        ? { ...item, status, completed: status === "completed" }
        : item)
      .filter(isOpenTask));

    const result = await updateMyDashboardTaskStatus(task.id, status);
    setSavingId(null);
    if (!result.ok) {
      setTasks(previous);
      setError(result.error);
    }
  }

  if (!taskCount) return <p className="py-6 text-sm text-gray-500">No open tasks assigned to you.</p>;

  return (
    <div>
      {error ? (
        <div role="alert" className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
      <div className="max-h-[32rem] overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
        {groupOrder.map((group) => grouped[group].length ? (
          <section key={group} className="mb-3 last:mb-0">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 py-1.5 backdrop-blur">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{group}</h3>
              <span className="text-[11px] text-gray-400">{grouped[group].length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {grouped[group].map((task) => (
                <article key={task.id} className="py-2.5 sm:px-1">
                  <div className="flex items-start gap-2">
                    <Link href={`/tasks?task=${task.id}`} className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
                      <p className="truncate text-sm font-medium text-gray-900">{task.title}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{task.jobs ? formatJobDisplayName({ customerName: task.jobs.customer?.full_name ?? task.customers?.full_name, jobName: task.jobs.customer_name, qfNumber: task.jobs.qfloors_job_number }) : task.customers?.full_name ?? "Business task"}</p>
                    </Link>
                    <select
                      aria-label={`Status for ${task.title}`}
                      value={task.status}
                      disabled={savingId === task.id}
                      onChange={(event) => void changeStatus(task, event.target.value as TaskStatus)}
                      className="min-h-8 max-w-28 shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 text-[11px] font-semibold text-gray-700 outline-none focus:border-gray-500 disabled:opacity-60"
                    >
                      {TASK_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                    </select>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <TaskBadge value={task.priority} priority />
                    {task.task_types?.name ? <TaskBadge value={task.task_types.name} /> : null}
                    <span className="text-gray-500">{formatTaskDue(task.due_at, task.due_date, timeZone)}</span>
                  </div>
                  {task.latest_note?.body ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-gray-500">
                      <span className="font-medium text-gray-600">Latest note:</span> {task.latest_note.body}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null)}
      </div>
    </div>
  );
}

function isOpenTask(task: WorkspaceTask) {
  return !task.completed && task.status !== "completed" && task.status !== "cancelled";
}

function dueKey(task: WorkspaceTask, timeZone: string) {
  if (task.due_at) return dateKeyInTimeZone(task.due_at, timeZone);
  return task.due_date;
}

function getDueGroup(task: WorkspaceTask, today: string, timeZone: string): DueGroup {
  const due = dueKey(task, timeZone);
  if (!due) return "No Due Date";
  if (due < today) return "Overdue";
  if (due === today) return "Due Today";
  return "Upcoming";
}

function compareTasks(first: WorkspaceTask, second: WorkspaceTask, timeZone: string) {
  const firstDue = dueKey(first, timeZone) ?? "9999-12-31";
  const secondDue = dueKey(second, timeZone) ?? "9999-12-31";
  if (firstDue !== secondDue) return firstDue.localeCompare(secondDue);
  const priorities: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  return (priorities[first.priority] ?? 4) - (priorities[second.priority] ?? 4);
}

function label(value: string) {
  return value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function TaskBadge({ value, priority = false }: { value: string; priority?: boolean }) {
  const color = priority && value === "urgent"
    ? "bg-red-50 text-red-700"
    : priority && value === "high"
      ? "bg-amber-50 text-amber-700"
      : "bg-gray-100 text-gray-600";
  return <span className={`rounded-full px-2 py-0.5 font-semibold ${color}`}>{label(value)}</span>;
}
