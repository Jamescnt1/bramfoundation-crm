"use server";

import { revalidatePath } from "next/cache";
import { TASK_STATUSES, type TaskStatus } from "@/components/tasks/types";
import { requireEmployee } from "@/lib/services/employees";
import { setTaskStatus } from "@/lib/services/tasks";
import { createClient } from "@/lib/supabase/server";

export type DashboardTaskStatusResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateMyDashboardTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<DashboardTaskStatusResult> {
  try {
    const employee = await requireEmployee();
    if (!taskId || !TASK_STATUSES.includes(status)) {
      return { ok: false, error: "Choose a valid task status." };
    }

    const supabase = await createClient();
    const { data: task, error } = await supabase
      .from("job_tasks")
      .select("id, assigned_employee_id")
      .eq("id", taskId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!task || task.assigned_employee_id !== employee.id) {
      return { ok: false, error: "You can only update tasks assigned to you." };
    }

    await setTaskStatus(task.id, status);
    revalidatePath("/my-dashboard");
    revalidatePath("/tasks");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to update the task.",
    };
  }
}
