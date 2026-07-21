import TaskManager from "@/components/tasks/TaskManager";
import type { UniversalTask, TaskType } from "@/components/tasks/types";
import type { Customer } from "@/components/customers/types";
import { getCustomers } from "@/lib/services/customers";
import { getActiveEmployees, requireEmployee, type Employee } from "@/lib/services/employees";
import { getJobs, type Job } from "@/lib/services/jobs";
import { getTasks, getTaskTypes } from "@/lib/services/tasks";

export const dynamic = "force-dynamic";

type TasksPageProps = { searchParams: Promise<{ task?: string }> };

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const { task: initialTaskId } = await searchParams;
  const employee = await requireEmployee();

  let tasks: UniversalTask[] = [];
  let customers: Customer[] = [];
  let jobs: Job[] = [];
  let employees: Employee[] = [];
  let taskTypes: TaskType[] = [];
  let errorMessage = "";

  try {
    [tasks, customers, jobs, employees, taskTypes] = await Promise.all([
      getTasks(), getCustomers(), getJobs(), getActiveEmployees(), getTaskTypes(),
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unexpected error";
  }

  return <main className="min-h-screen bg-gray-50 p-6 md:p-8"><div className="mx-auto max-w-7xl">
    <header><p className="text-sm font-medium text-gray-500">Work Management</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Tasks</h1><p className="mt-2 text-gray-600">Manage customer work, job follow-ups, and the everyday tasks that keep the business running.</p></header>
    {errorMessage ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">Unable to load tasks: {errorMessage}</div> :
      <TaskManager initialTasks={tasks} customers={customers} jobs={jobs} employees={employees} taskTypes={taskTypes} currentEmployeeId={employee.id} initialTaskId={initialTaskId} />}
  </div></main>;
}
