export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TASK_STATUSES = ["open", "in_progress", "waiting", "completed", "cancelled"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskType = { id: string; name: string; active: boolean; sort_order: number };
export type TaskRelation = {
  id: string;
  full_name?: string;
  customer_name?: string;
  qfloors_job_number?: string | null;
  customer?: { id: string; full_name: string } | null;
};

export type UniversalTask = {
  id: string;
  job_id: string | null;
  customer_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_employee_id: string | null;
  due_date: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  task_type_id: string | null;
  customers: TaskRelation | null;
  jobs: TaskRelation | null;
  employees: { id: string; name: string } | null;
  task_types: TaskType | null;
};
