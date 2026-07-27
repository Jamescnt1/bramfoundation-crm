"use client";

import { useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Employee } from "@/lib/services/employees";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskType,
} from "@/components/tasks/types";

export type TaskDueFilter = "all" | "overdue" | "today" | "upcoming" | "no_due";
export type TaskStatusFilter = "active" | "all" | (typeof TASK_STATUSES)[number];

export type TaskViewOptionsValue = {
  search: string;
  assignee: string;
  status: TaskStatusFilter;
  priority: string;
  category: string;
  due: TaskDueFilter;
};

type Props = {
  open: boolean;
  value: TaskViewOptionsValue;
  employees: Employee[];
  taskTypes: TaskType[];
  onOpenChange: (open: boolean) => void;
  onApply: (value: TaskViewOptionsValue) => void;
};

export const defaultTaskViewOptions: TaskViewOptionsValue = {
  search: "",
  assignee: "all",
  status: "active",
  priority: "all",
  category: "all",
  due: "all",
};

export default function TaskViewOptions({
  open,
  value,
  employees,
  taskTypes,
  onOpenChange,
  onApply,
}: Props) {
  const [draft, setDraft] = useState(value);

  function apply() {
    onApply(draft);
    onOpenChange(false);
  }

  function reset() {
    setDraft(defaultTaskViewOptions);
    onApply(defaultTaskViewOptions);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-x-0 top-auto bottom-0 left-0 flex max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-b-none rounded-t-2xl p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(86dvh,42rem)] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-gray-200 px-5 py-4 pr-12">
          <DialogTitle>Task View Options</DialogTitle>
          <DialogDescription>
            Search and filter the task list without taking space away from the work.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch]">
          <label className="block">
            <span className="text-sm font-semibold text-gray-900">Search</span>
            <span className="relative mt-2 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={draft.search}
                onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
                placeholder="Task, job, customer, employee, or note…"
                className={`${controlClass} pl-9`}
              />
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assignee">
              <select
                value={draft.assignee}
                onChange={(event) => setDraft((current) => ({ ...current, assignee: event.target.value }))}
                className={controlClass}
              >
                <option value="all">All assignees</option>
                <option value="mine">My tasks</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  status: event.target.value as TaskStatusFilter,
                }))}
                className={controlClass}
              >
                <option value="active">Open tasks</option>
                <option value="all">All statuses</option>
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>{label(status)}</option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <select
                value={draft.priority}
                onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}
                className={controlClass}
              >
                <option value="all">All priorities</option>
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{label(priority)}</option>
                ))}
              </select>
            </Field>

            <Field label="Category">
              <select
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                className={controlClass}
              >
                <option value="all">All categories</option>
                {taskTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Due date">
              <select
                value={draft.due}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  due: event.target.value as TaskDueFilter,
                }))}
                className={controlClass}
              >
                <option value="all">Any due date</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due today</option>
                <option value="upcoming">Upcoming</option>
                <option value="no_due">No due date</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-900">
      <span>{text}</span>
      {children}
    </label>
  );
}

function label(value: string) {
  return value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

const controlClass = "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-700 outline-none focus:border-black focus:ring-2 focus:ring-gray-200 sm:text-sm";
