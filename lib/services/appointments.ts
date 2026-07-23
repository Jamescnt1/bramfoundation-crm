import type { CalendarAppointment } from "@/components/calendar/types";
import type {
  AppointmentStatus,
  AppointmentType,
} from "@/components/calendar/constants";
import { supabase } from "@/lib/supabase";

export type AppointmentValues = {
  title: string;
  appointment_type: AppointmentType;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
  assigned_employee_id: string | null;
  installer_crew_id: string | null;
};

export type CreateAppointmentValues = AppointmentValues & {
  job_id?: string | null;
};

export async function getAppointments() {
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      assigned_employee:employees!appointments_assigned_employee_id_fkey (
        id,
        name
      ),
      installer_crew:installer_crews!appointments_installer_crew_id_fkey (
        id,
        name
      ),
      job:jobs!appointments_job_id_fkey (
        id,
        customer_id,
        customer_name,
        qfloors_job_number,
        status,
        customer:customers!jobs_customer_id_fkey (id, full_name)
      )
    `)
    .order("starts_at");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CalendarAppointment[];
}

export async function getAppointmentsByJobId(jobId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      assigned_employee:employees!appointments_assigned_employee_id_fkey (
        id,
        name
      ),
      installer_crew:installer_crews!appointments_installer_crew_id_fkey (
        id,
        name
      ),
      job:jobs!appointments_job_id_fkey (
        id,
        customer_id,
        customer_name,
        qfloors_job_number,
        status,
        customer:customers!jobs_customer_id_fkey (id, full_name)
      )
    `)
    .eq("job_id", jobId)
    .order("starts_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as CalendarAppointment[];
}

export async function completeAppointment(
  appointmentId: string,
) {
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", appointmentId)
    .select(`
      *,
      assigned_employee:employees!appointments_assigned_employee_id_fkey (
        id,
        name
      ),
      installer_crew:installer_crews!appointments_installer_crew_id_fkey (
        id,
        name
      ),
      job:jobs!appointments_job_id_fkey (
        id,
        customer_id,
        customer_name,
        qfloors_job_number,
        status,
        customer:customers!jobs_customer_id_fkey (id, full_name)
      )
    `)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CalendarAppointment;
}

export async function createAppointment(
  values: CreateAppointmentValues,
) {
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      ...values,
      job_id: values.job_id ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CalendarAppointment;
}

export async function updateAppointment(
  appointmentId: string,
  values: AppointmentValues,
) {
  const { data, error } = await supabase
    .from("appointments")
    .update(values)
    .eq("id", appointmentId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CalendarAppointment;
}
