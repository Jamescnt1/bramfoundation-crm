"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import SalespersonSelect from "@/components/SalespersonSelect";

export type JobTask = {
  id: string;
  job_id: string;
  title: string;
  assigned_to: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

type LeadTasksProps = {
  jobId: string;
  initialTasks: JobTask[];
};

export default function LeadTasks({
  jobId,
  initialTasks,
}: LeadTasksProps) {
  const [tasks, setTasks] = useState<JobTask[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState("");

  const openTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  async function addTask(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanedTitle = title.trim();

    if (!cleanedTitle) {
      return;
    }

    setIsAdding(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("job_tasks")
      .insert({
        job_id: jobId,
        title: cleanedTitle,
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
      })
      .select(
        "id, job_id, title, assigned_to, due_date, completed, completed_at, created_at"
      )
      .single();

    if (error) {
      setErrorMessage(`Unable to add task: ${error.message}`);
      setIsAdding(false);
      return;
    }

    setTasks((currentTasks) =>
      sortTasks([...currentTasks, data])
    );

    setTitle("");
    setAssignedTo("");
    setDueDate("");
    setIsAdding(false);
  }

  async function toggleTask(task: JobTask) {
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
          currentTask.id === task.id ? task : currentTask
        )
      );

      setErrorMessage(
        `Unable to update task: ${error.message}`
      );
    }

    setUpdatingTaskId(null);
  }

  async function deleteTask(task: JobTask) {
    const shouldDelete = window.confirm(
      `Permanently delete the task "${task.title}"?\n\nThis beta cleanup action cannot be undone.`
    );

    if (!shouldDelete) {
      return;
    }

    setUpdatingTaskId(task.id);
    setErrorMessage("");

    const previousTasks = tasks;

    setTasks((currentTasks) =>
      currentTasks.filter(
        (currentTask) => currentTask.id !== task.id
      )
    );

    try {
      const { deleteTaskPermanentlyAction } = await import("@/app/actions/beta-delete");
      await deleteTaskPermanentlyAction(task.id);
    } catch (error) {
      setTasks(previousTasks);
      setErrorMessage(
        `Unable to delete task: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    setUpdatingTaskId(null);
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm lg:col-span-3">
      <div>
        <h2 className="text-xl font-semibold">Tasks</h2>

        <p className="mt-1 text-sm text-gray-500">
          Track calls, measures, estimates, samples, and
          other work for this lead.
        </p>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={addTask}
        className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4"
      >
        <h3 className="font-semibold">Add Task</h3>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <label
              htmlFor="taskTitle"
              className="block text-sm font-medium text-gray-700"
            >
              Task
            </label>

            <input
              id="taskTitle"
              type="text"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Call customer with estimate"
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Assigned To
            </label>

            <SalespersonSelect
              value={assignedTo}
              onChange={setAssignedTo}
            />
          </div>

          <div>
            <label
              htmlFor="taskDueDate"
              className="block text-sm font-medium text-gray-700"
            >
              Due Date
            </label>

            <input
              id="taskDueDate"
              type="date"
              value={dueDate}
              onChange={(event) =>
                setDueDate(event.target.value)
              }
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isAdding}
          className="mt-4 rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
        >
          {isAdding ? "Adding..." : "Add Task"}
        </button>
      </form>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-semibold">
            Open Tasks
          </h3>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
            {openTasks.length}
          </span>
        </div>

        {openTasks.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-5 text-sm text-gray-500">
            No open tasks for this lead.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {openTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isUpdating={updatingTaskId === task.id}
                onToggle={toggleTask}
                onDelete={deleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {completedTasks.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-semibold text-gray-600">
              Completed Tasks
            </h3>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
              {completedTasks.length}
            </span>
          </div>

          <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {completedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isUpdating={updatingTaskId === task.id}
                onToggle={toggleTask}
                onDelete={deleteTask}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  isUpdating,
  onToggle,
  onDelete,
}: {
  task: JobTask;
  isUpdating: boolean;
  onToggle: (task: JobTask) => void;
  onDelete: (task: JobTask) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          disabled={isUpdating}
          onChange={() => onToggle(task)}
          aria-label={`Mark ${task.title} as ${
            task.completed ? "open" : "complete"
          }`}
          className="mt-1 h-4 w-4 rounded border-gray-300"
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
              {task.assigned_to ?? "Unassigned"}
            </span>

            <span
              className={
                !task.completed && isOverdue(task.due_date)
                  ? "font-medium text-red-600"
                  : ""
              }
            >
              {formatTaskDueDate(task.due_date)}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={isUpdating}
        onClick={() => onDelete(task)}
        className="w-fit text-sm font-medium text-gray-500 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}

function sortTasks(tasks: JobTask[]) {
  return [...tasks].sort((firstTask, secondTask) => {
    if (firstTask.completed !== secondTask.completed) {
      return firstTask.completed ? 1 : -1;
    }

    if (!firstTask.due_date && !secondTask.due_date) {
      return (
        new Date(secondTask.created_at).getTime() -
        new Date(firstTask.created_at).getTime()
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

function formatTaskDueDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  const formattedDate = new Date(
    `${value}T00:00:00`
  ).toLocaleDateString();

  if (isOverdue(value)) {
    return `Overdue · ${formattedDate}`;
  }

  return `Due ${formattedDate}`;
}

function isOverdue(value: string | null) {
  if (!value) {
    return false;
  }

  const dueDate = new Date(`${value}T23:59:59`);

  return dueDate < new Date();
}
