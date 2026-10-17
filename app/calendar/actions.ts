"use server";

import { revalidatePath } from "next/cache";
import {
  copyAppointmentToEmployee,
  createAppointment,
  linkAppointmentsToMaterialScopes,
  updateAppointment,
  updateLinkedProductionScopeDescription,
  type AppointmentUpdateScope,
  type AppointmentValues,
  type CreateAppointmentValues,
} from "@/lib/services/appointments";
import { requireEmployee } from "@/lib/services/employees";

type SaveAppointmentInput =
  | {
      mode: "create";
      values: CreateAppointmentValues;
      materialScopeIds: string[];
      installationScope: string;
    }
  | {
      mode: "update";
      appointmentId: string;
      values: AppointmentValues;
      updateScope: AppointmentUpdateScope;
      materialScopeIds: string[];
      installationScope: string;
    };

export async function saveAppointmentAction(input: SaveAppointmentInput) {
  await requireEmployee();
  validateAppointmentInput(input);

  let appointmentIds: string[];
  if (input.mode === "update") {
    await updateAppointment(
      input.appointmentId,
      input.values,
      input.updateScope,
    );
    appointmentIds = [input.appointmentId];
  } else {
    const created = await createAppointment(input.values);
    appointmentIds = created.map((appointment) => appointment.id);
  }

  if (["installation", "job_walk"].includes(input.values.appointment_type)) {
    await linkAppointmentsToMaterialScopes(
      appointmentIds,
      input.materialScopeIds,
    );
    if (input.values.appointment_type === "installation") {
      await updateLinkedProductionScopeDescription(
        input.materialScopeIds,
        input.installationScope,
      );
    }
  }

  revalidateAppointmentPaths(input.values.job_id);
  return { appointmentIds };
}

export async function copyAppointmentToEmployeeAction(
  appointmentId: string,
  employeeId: string,
  scope: "occurrence" | "series" = "occurrence",
) {
  await requireEmployee();
  if (!isUuid(appointmentId) || !isUuid(employeeId)) {
    throw new Error("The appointment or employee selection is invalid.");
  }
  const copies = await copyAppointmentToEmployee(
    appointmentId,
    employeeId,
    scope,
  );
  revalidatePath("/calendar");
  return copies;
}

function revalidateAppointmentPaths(jobId: string | null) {
  revalidatePath("/calendar");
  revalidatePath("/my-dashboard");
  revalidatePath("/company");
  if (jobId) revalidatePath(`/leads/${jobId}`);
}

function validateAppointmentInput(input: SaveAppointmentInput) {
  if (input.mode === "update" && !isUuid(input.appointmentId)) {
    throw new Error("The appointment selection is invalid.");
  }
  if (input.values.job_id && !isUuid(input.values.job_id)) {
    throw new Error("The selected job is invalid.");
  }
  if (input.values.assigned_employee_id && !isUuid(input.values.assigned_employee_id)) {
    throw new Error("The assigned employee is invalid.");
  }
  if (input.values.installer_crew_id && !isUuid(input.values.installer_crew_id)) {
    throw new Error("The selected installer crew is invalid.");
  }
  if (input.materialScopeIds.some((id) => !isUuid(id))) {
    throw new Error("A selected production scope is invalid.");
  }

  const startsAt = new Date(input.values.starts_at);
  const endsAt = new Date(input.values.ends_at);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    throw new Error("The appointment ending time must be after its starting time.");
  }
  if (!input.values.appointment_type.trim()) {
    throw new Error("Choose an appointment type.");
  }
  if (
    input.values.reminder_hours_before !== null &&
    (!Number.isInteger(input.values.reminder_hours_before) ||
      input.values.reminder_hours_before < 1 ||
      input.values.reminder_hours_before > 720)
  ) {
    throw new Error("Reminder timing must be between 1 and 720 hours.");
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
