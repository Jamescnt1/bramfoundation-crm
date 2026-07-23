import type { CalendarAppointment } from "@/components/calendar/types";
import type {
  AppointmentStatus,
  AppointmentType,
} from "@/components/calendar/constants";
import { supabase } from "@/lib/supabase";
import { formatAppointmentDisplayName } from "@/lib/appointment-display";

export type AppointmentValues = {
  appointment_type: AppointmentType;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
  assigned_employee_id: string | null;
  installer_crew_id: string | null;
  job_id: string | null;
};

export type CreateAppointmentValues = AppointmentValues;

async function generatedAppointmentTitle(
  jobId: string | null,
  appointmentType: AppointmentType,
) {
  if (!jobId) {
    return formatAppointmentDisplayName({ appointmentType });
  }

  const { data, error } = await supabase
    .from("jobs")
    .select(`
      customer_name,
      customer:customers!jobs_customer_id_fkey (full_name)
    `)
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const customerRelation = Array.isArray(data?.customer)
    ? data.customer[0] ?? null
    : data?.customer ?? null;

  return formatAppointmentDisplayName({
    appointmentType,
    customerName: customerRelation?.full_name,
    jobName: data?.customer_name,
  });
}

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
  const title = await generatedAppointmentTitle(
    values.job_id,
    values.appointment_type,
  );
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      ...values,
      title,
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
  const title = await generatedAppointmentTitle(
    values.job_id,
    values.appointment_type,
  );
  const { data, error } = await supabase
    .from("appointments")
    .update({ ...values, title })
    .eq("id", appointmentId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CalendarAppointment;
}

export async function deleteAppointment(appointmentId: string) {
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId);

  if (error) {
    throw new Error(error.message);
  }
}
