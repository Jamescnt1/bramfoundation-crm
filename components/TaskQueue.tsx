"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatJobDisplayName } from "@/lib/job-display";

export type GlobalTask = {
  id: string;
  job_id: string;
  title: string;
  assigned_to: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  jobs: {
    id: string;
    customer_name: string;
    qfloors_job_number?: string | null;
    customer?: { id: string; full_name: string } | null;
  } | null;
};

type TaskQueueProps = {
  initialTasks: GlobalTask[];
};

type TaskFilter =
  | "all"
  | "overdue"
  | "today"
  | "upcoming"
  | "no-date"
  | "completed";

export default function TaskQueue({
  initialTasks,
}: TaskQueueProps) {
  const [tasks, setTasks] =
    useState<GlobalTask[]>(initialTasks);

  const [activeFilter, setActiveFilter] =
    useState<TaskFilter>("all");

  const [updatingTaskId, setUpdatingTaskId] = useState<
    string | null
  >(null);

  const [errorMessage, setErrorMessage] = useState("");

  const taskCounts = useMemo(
    () => ({
      all: tasks.filter((task) => !task.completed).length,

      overdue: tasks.filter(
        (task) =>
          !task.completed &&
          isOverdue(task.due_date)
      ).length,

      today: tasks.filter(
        (task) =>
          !task.completed &&
          isToday(task.due_date)
      ).length,

      upcoming: tasks.filter(
        (task) =>
          !task.completed &&
          isUpcoming(task.due_date)
      ).length,

      "no-date": tasks.filter(
        (task) =>
          !task.completed &&
          !task.due_date
      ).length,

      completed: tasks.filter(
        (task) => task.completed
      ).length,
    }),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    const filteredTasks = tasks.filter((task) => {
      switch (activeFilter) {
        case "overdue":
          return (
            !task.completed &&
            isOverdue(task.due_date)
          );

        case "today":
          return (
            !task.completed &&
            isToday(task.due_date)
          );

        case "upcoming":
          return (
            !task.completed &&
            isUpcoming(task.due_date)
          );

        case "no-date":
          return (
            !task.completed &&
            !task.due_date
          );

        case "completed":
          return task.completed;

        case "all":
        default:
          return !task.completed;
      }
    });

    return sortTasks(filteredTasks);
  }, [tasks, activeFilter]);

  async function toggleTask(task: GlobalTask) {
    const newCompletedValue = !task.completed;

    const completedAt = newCompletedValue
      ? new Date().toISOString()
      : null;

    setUpdatingTaskId(task.id);
    setErrorMessage("");

    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id
          ? {
              ...currentTask,
              completed: newCompletedValue,
              completed_at: completedAt,
            }
          : currentTask
      )
    );

    const { error } = await supabase
      .from("job_tasks")
      .update({
        completed: newCompletedValue,
        completed_at: completedAt,
      })
      .eq("id", task.id);

    if (error) {
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id
            ? task
            : currentTask
        )
      );

      setErrorMessage(
        `Unable to update "${task.title}": ${error.message}`
      );
    }

    setUpdatingTaskId(null);
  }

  return (
    <>
      {errorMessage && (
        <div className="mt-6 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="font-semibold"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          title="Open Tasks"
          value={taskCounts.all}
        />

        <SummaryCard
          title="Overdue"
          value={taskCounts.overdue}
          important={taskCounts.overdue > 0}
        />

        <SummaryCard
          title="Due Today"
          value={taskCounts.today}
        />

        <SummaryCard
          title="Upcoming"
          value={taskCounts.upcoming}
        />

        <SummaryCard
          title="No Due Date"
          value={taskCounts["no-date"]}
        />
      </section>

      <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <FilterButton
            label="All Open"
            count={taskCounts.all}
            filter="all"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />

          <FilterButton
            label="Overdue"
            count={taskCounts.overdue}
            filter="overdue"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />

          <FilterButton
            label="Due Today"
            count={taskCounts.today}
            filter="today"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />

          <FilterButton
            label="Upcoming"
            count={taskCounts.upcoming}
            filter="upcoming"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />

          <FilterButton
            label="No Due Date"
            count={taskCounts["no-date"]}
            filter="no-date"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />

          <FilterButton
            label="Completed"
            count={taskCounts.completed}
            filter="completed"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />
        </div>

        {visibleTasks.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="font-medium text-gray-700">
              No tasks in this section
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Tasks added from a lead will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {visibleTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isUpdating={
                  updatingTaskId === task.id
                }
                onToggle={toggleTask}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SummaryCard({
  title,
  value,
  important = false,
}: {
  title: string;
  value: number;
  important?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${
        important
          ? "border-red-200 bg-red-50"
          : "border-gray-100 bg-white"
      }`}
    >
      <p
        className={`text-sm font-medium ${
          important
            ? "text-red-700"
            : "text-gray-500"
        }`}
      >
        {title}
      </p>

      <p
        className={`mt-2 text-3xl font-bold ${
          important
            ? "text-red-700"
            : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  label,
  count,
  filter,
  activeFilter,
  onClick,
}: {
  label: string;
  count: number;
  filter: TaskFilter;
  activeFilter: TaskFilter;
  onClick: (filter: TaskFilter) => void;
}) {
  const isActive = activeFilter === filter;

  return (
    <button
      type="button"
      onClick={() => onClick(filter)}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        isActive
          ? "bg-black text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label} ({count})
    </button>
  );
}

function TaskRow({
  task,
  isUpdating,
  onToggle,
}: {
  task: GlobalTask;
  isUpdating: boolean;
  onToggle: (task: GlobalTask) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          disabled={isUpdating}
          onChange={() => onToggle(task)}
          aria-label={`Mark ${task.title} as ${
            task.completed ? "open" : "complete"
          }`}
          className="mt-1 h-4 w-4 flex-none rounded border-gray-300"
        />

        <div className="min-w-0">
          <p
            className={
              task.completed
                ? "text-gray-500 line-through"
                : "font-medium text-gray-900"
            }
          >
            {task.title}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>
              Customer:{" "}
              <Link
                href={`/leads/${task.job_id}`}
                className="font-medium text-gray-700 hover:text-black hover:underline"
              >
                {task.jobs
                  ? formatJobDisplayName({
                      customerName: task.jobs.customer?.full_name,
                      jobName: task.jobs.customer_name,
                      qfNumber: task.jobs.qfloors_job_number,
                    })
                  : "Unknown job"}
              </Link>
            </span>

            <span>
              Assigned:{" "}
              {task.assigned_to ?? "Unassigned"}
            </span>

            <span
              className={getDueDateClass(task)}
            >
              {formatDueDate(task)}
            </span>
          </div>
        </div>
      </div>

      <Link
        href={`/leads/${task.job_id}`}
        className="w-fit text-sm font-medium text-gray-600 hover:text-black"
      >
        View lead →
      </Link>
    </div>
  );
}

function sortTasks(tasks: GlobalTask[]) {
  return [...tasks].sort((firstTask, secondTask) => {
    if (
      firstTask.completed &&
      secondTask.completed
    ) {
      return (
        new Date(
          secondTask.completed_at ??
            secondTask.created_at
        ).getTime() -
        new Date(
          firstTask.completed_at ??
            firstTask.created_at
        ).getTime()
      );
    }

    if (!firstTask.due_date && !secondTask.due_date) {
      return (
        new Date(firstTask.created_at).getTime() -
        new Date(secondTask.created_at).getTime()
      );
    }

    if (!firstTask.due_date) {
      return 1;
    }

    if (!secondTask.due_date) {
      return -1;
    }

    return firstTask.due_date.localeCompare(
      secondTask.due_date
    );
  });
}

function formatDueDate(task: GlobalTask) {
  if (task.completed) {
    if (!task.completed_at) {
      return "Completed";
    }

    return `Completed ${new Date(
      task.completed_at
    ).toLocaleDateString()}`;
  }

  if (!task.due_date) {
    return "No due date";
  }

  const formattedDate = new Date(
    `${task.due_date}T00:00:00`
  ).toLocaleDateString();

  if (isToday(task.due_date)) {
    return `Due today · ${formattedDate}`;
  }

  if (isOverdue(task.due_date)) {
    return `Overdue · ${formattedDate}`;
  }

  return `Due ${formattedDate}`;
}

function getDueDateClass(task: GlobalTask) {
  if (task.completed) {
    return "text-gray-500";
  }

  if (isOverdue(task.due_date)) {
    return "font-semibold text-red-600";
  }

  if (isToday(task.due_date)) {
    return "font-semibold text-amber-600";
  }

  return "";
}

function getTodayDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");
  const day = String(now.getDate()).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}

function isToday(value: string | null) {
  if (!value) {
    return false;
  }

  return value === getTodayDateString();
}

function isOverdue(value: string | null) {
  if (!value) {
    return false;
  }

  return value < getTodayDateString();
}

function isUpcoming(value: string | null) {
  if (!value) {
    return false;
  }

  return value > getTodayDateString();
}
