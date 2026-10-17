import TaskManager from "@/components/tasks/TaskManager";
import type { UniversalTask, TaskType } from "@/components/tasks/types";
import type { Customer } from "@/components/customers/types";
import { getCustomers } from "@/lib/services/customers";
import { getActiveEmployees, requireEmployee, type Employee } from "@/lib/services/employees";
import { getJobs, type Job } from "@/lib/services/jobs";
import { getTasks, getTaskTypes } from "@/lib/services/tasks";
import PageHeader from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

type TasksPageProps = {
  searchParams: Promise<{
    task?: string;
    new?: string;
  }>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const {
    task: initialTaskId,
    new: newTask,
  } = await searchParams;
  const employee = await requireEmployee();

  let tasks: UniversalTask[] = [];
  let customers: Customer[] = [];
  let jobs: Job[] = [];
  let employees: Employee[] = [];
  let taskTypes: TaskType[] = [];
  let errorMessage = "";

  try {
    const [activeTasks, selectedTasks, loadedCustomers, loadedJobs, loadedEmployees, loadedTaskTypes] = await Promise.all([
      getTasks({ activeOnly: true }),
      initialTaskId ? getTasks({ taskId: initialTaskId }) : Promise.resolve([]),
      getCustomers(),
      getJobs(),
      getActiveEmployees(),
      getTaskTypes(),
    ]);
    tasks = [...activeTasks];
    for (const task of selectedTasks) {
      if (!tasks.some((item) => item.id === task.id)) tasks.push(task);
    }
    customers = loadedCustomers;
    jobs = loadedJobs;
    employees = loadedEmployees;
    taskTypes = loadedTaskTypes;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unexpected error";
  }

  return <main className="min-h-screen bg-gray-50 p-6 md:p-8"><div className="mx-auto max-w-7xl">
    <PageHeader eyebrow="Work Management" title="Tasks" description="Manage customer work, job follow-ups, and the everyday tasks that keep the business running." />
    {errorMessage ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">Unable to load tasks: {errorMessage}</div> :
      <TaskManager initialTasks={tasks} customers={customers} jobs={jobs} employees={employees} taskTypes={taskTypes} currentEmployeeId={employee.id} currentEmployeeRole={employee.role} initialTaskId={initialTaskId} initialNewTask={newTask === "1"} />}
  </div></main>;
}
