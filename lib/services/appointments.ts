import type { CalendarAppointment } from "@/components/calendar/types";
import type {
  AppointmentStatus,
  AppointmentType,
} from "@/components/calendar/constants";
import { supabase } from "@/lib/supabase";
import { formatAppointmentDisplayName } from "@/lib/appointment-display";

export type AppointmentValues = {
  title: string | null;
  appointment_type: AppointmentType;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
  installation_scope: string | null;
  assigned_employee_id: string | null;
  installer_crew_id: string | null;
  job_id: string | null;
  all_day: boolean;
};

export type RecurrenceInput = {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  endsOn: string;
};

export type CreateAppointmentValues = AppointmentValues & {
  recurrence?: RecurrenceInput | null;
};

export type AppointmentUpdateScope = "occurrence" | "future" | "series";

async function generatedAppointmentTitle(
  jobId: string | null,
  appointmentType: AppointmentType,
) {
  const { data: appointmentTypeRecord, error: appointmentTypeError } =
    await supabase
      .from("appointment_types")
      .select("name")
      .eq("key", appointmentType)
      .maybeSingle();
  if (appointmentTypeError) throw new Error(appointmentTypeError.message);

  if (!jobId) {
    return formatAppointmentDisplayName({
      appointmentType,
      appointmentTypeLabel: appointmentTypeRecord?.name,
    });
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
    appointmentTypeLabel: appointmentTypeRecord?.name,
    customerName: customerRelation?.full_name,
    jobName: data?.customer_name,
  });
}

export async function getAppointmentsByJobId(jobId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      appointment_type_record:appointment_types!appointments_appointment_type_fkey (
        key,
        name,
        active
      ),
      assigned_employee:employees!appointments_assigned_employee_id_fkey (
        id,
        name,
        color
      ),
      installer_crew:installer_crews!appointments_installer_crew_id_fkey (
        id,
        name,
        color
      ),
      work_order_sender:employees!appointments_work_order_sent_by_fkey (
        id,
        name
      ),
      job:jobs!appointments_job_id_fkey (
        id,
        customer_id,
        customer_name,
        project_customer_name,
        qfloors_job_number,
        address,
        status,
        installation_required,
        customer:customers!jobs_customer_id_fkey (id, full_name),
        company_contact:customer_contacts!jobs_company_contact_id_fkey (
          first_name, last_name, job_title, email, office_phone, mobile_phone
        ),
        project_contact:customer_contacts!jobs_project_contact_id_fkey (
          first_name, last_name, job_title, email, office_phone, mobile_phone
        ),
        job_site_contact:customer_contacts!jobs_job_site_contact_id_fkey (
          first_name, last_name, job_title, email, office_phone, mobile_phone
        )
      )
    `)
    .eq("job_id", jobId)
    .order("starts_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as CalendarAppointment[];
}

export async function getInstallationJobIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("job_id")
    .eq("appointment_type", "installation")
    .neq("status", "cancelled")
    .not("job_id", "is", null);

  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).flatMap((row) => row.job_id ? [row.job_id] : []))];
}

export async function getWorkOrderReadyJobIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("job_id, work_order_status")
    .eq("appointment_type", "installation")
    .neq("status", "cancelled")
    .not("job_id", "is", null);

  if (error) throw new Error(error.message);

  const grouped = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!row.job_id) continue;
    grouped.set(row.job_id, [
      ...(grouped.get(row.job_id) ?? []),
      row.work_order_status,
    ]);
  }

  return [...grouped.entries()]
    .filter(([, statuses]) =>
      statuses.length > 0 &&
      statuses.every((status) => status === "sent" || status === "acknowledged"),
    )
    .map(([jobId]) => jobId);
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
      appointment_type_record:appointment_types!appointments_appointment_type_fkey (
        key,
        name,
        active
      ),
      assigned_employee:employees!appointments_assigned_employee_id_fkey (
        id,
        name,
        color
      ),
      installer_crew:installer_crews!appointments_installer_crew_id_fkey (
        id,
        name,
        color
      ),
      work_order_sender:employees!appointments_work_order_sent_by_fkey (
        id,
        name
      ),
      job:jobs!appointments_job_id_fkey (
        id,
        customer_id,
        customer_name,
        project_customer_name,
        qfloors_job_number,
        address,
        status,
        installation_required,
        customer:customers!jobs_customer_id_fkey (id, full_name),
        company_contact:customer_contacts!jobs_company_contact_id_fkey (
          first_name, last_name, job_title, email, office_phone, mobile_phone
        ),
        project_contact:customer_contacts!jobs_project_contact_id_fkey (
          first_name, last_name, job_title, email, office_phone, mobile_phone
        ),
        job_site_contact:customer_contacts!jobs_job_site_contact_id_fkey (
          first_name, last_name, job_title, email, office_phone, mobile_phone
        )
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
  const { recurrence, ...appointmentValues } = values;
  const title =
    appointmentValues.title?.trim() ||
    (await generatedAppointmentTitle(
      appointmentValues.job_id,
      appointmentValues.appointment_type,
    ));
  const rows = buildRecurringRows({ ...appointmentValues, title }, recurrence);
  const { data, error } = await supabase
    .from("appointments")
    .insert(rows)
    .select()
    .order("starts_at");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CalendarAppointment[];
}

export async function linkAppointmentsToMaterialScopes(
  appointmentIds: string[],
  materialScopeIds: string[],
) {
  if (!appointmentIds.length) return;
  const { error: deleteError } = await supabase
    .from("job_material_scope_appointments")
    .delete()
    .in("appointment_id", appointmentIds);
  if (deleteError) throw new Error(deleteError.message);
  if (!materialScopeIds.length) return;
  const rows = appointmentIds.flatMap((appointment_id) =>
    materialScopeIds.map((material_scope_id) => ({ appointment_id, material_scope_id })),
  );
  const { error } = await supabase.from("job_material_scope_appointments").insert(rows);
  if (error) throw new Error(error.message);
}

export async function updateLinkedProductionScopeDescription(
  materialScopeIds: string[],
  description: string,
) {
  if (materialScopeIds.length !== 1 || !description.trim()) return;
  const { error } = await supabase
    .from("job_material_scopes")
    .update({ description: description.trim() })
    .eq("id", materialScopeIds[0]);
  if (error) throw new Error(error.message);
}

export async function updateAppointment(
  appointmentId: string,
  values: AppointmentValues,
  scope: AppointmentUpdateScope = "occurrence",
) {
  const title =
    values.title?.trim() ||
    (await generatedAppointmentTitle(
      values.job_id,
      values.appointment_type,
    ));
  const { data: current, error: currentError } = await supabase
    .from("appointments")
    .select("id, starts_at, recurrence_series_id")
    .eq("id", appointmentId)
    .single();
  if (currentError) throw new Error(currentError.message);

  if (scope === "occurrence" || !current.recurrence_series_id) {
    const { data, error } = await supabase.from("appointments")
      .update({ ...values, title }).eq("id", appointmentId).select().single();
    if (error) throw new Error(error.message);
    return data as CalendarAppointment;
  }

  let query = supabase.from("appointments")
    .select("id, starts_at")
    .eq("recurrence_series_id", current.recurrence_series_id);
  if (scope === "future") query = query.gte("starts_at", current.starts_at);
  const { data: occurrences, error: occurrencesError } = await query.order("starts_at");
  if (occurrencesError) throw new Error(occurrencesError.message);

  const duration = new Date(values.ends_at).getTime() - new Date(values.starts_at).getTime();
  const futureSeriesId = scope === "future" ? crypto.randomUUID() : null;
  for (const occurrence of occurrences ?? []) {
    const occurrenceStart = occurrence.id === appointmentId
      ? new Date(values.starts_at)
      : withTime(new Date(occurrence.starts_at), new Date(values.starts_at));
    const { error } = await supabase.from("appointments").update({
      ...values,
      title,
      starts_at: occurrenceStart.toISOString(),
      ends_at: new Date(occurrenceStart.getTime() + duration).toISOString(),
      ...(futureSeriesId ? { recurrence_series_id: futureSeriesId } : {}),
    }).eq("id", occurrence.id);
    if (error) throw new Error(error.message);
  }

  return { ...values, id: appointmentId, title } as CalendarAppointment;
}

export async function copyAppointmentToEmployee(
  appointmentId: string,
  employeeId: string,
  scope: "occurrence" | "series" = "occurrence",
) {
  const { data: source, error: sourceError } = await supabase.from("appointments")
    .select("*").eq("id", appointmentId).single();
  if (sourceError) throw new Error(sourceError.message);

  let sources = [source];
  if (scope === "series" && source.recurrence_series_id) {
    const { data, error } = await supabase.from("appointments").select("*")
      .eq("recurrence_series_id", source.recurrence_series_id).order("starts_at");
    if (error) throw new Error(error.message);
    sources = data ?? [];
  }

  const copiedSeriesId = sources.length > 1 ? crypto.randomUUID() : null;
  const rows = sources.map((item) => ({
    title: item.title,
    appointment_type: item.appointment_type,
    starts_at: item.starts_at,
    ends_at: item.ends_at,
    status: "scheduled",
    location: item.location,
    notes: item.notes,
    installation_scope: null,
    assigned_employee_id: employeeId,
    installer_crew_id: null,
    job_id: item.job_id,
    all_day: item.all_day,
    recurrence_series_id: copiedSeriesId,
    recurrence_frequency: copiedSeriesId ? item.recurrence_frequency : null,
    recurrence_interval: copiedSeriesId ? item.recurrence_interval : null,
    recurrence_ends_on: copiedSeriesId ? item.recurrence_ends_on : null,
    copied_from_id: item.id,
  }));
  const { error } = await supabase.from("appointments").insert(rows);
  if (error) throw new Error(error.message);
}

function buildRecurringRows(
  values: AppointmentValues & { title: string },
  recurrence?: RecurrenceInput | null,
) {
  if (!recurrence) return [{ ...values }];
  const seriesId = crypto.randomUUID();
  const startsAt = new Date(values.starts_at);
  const duration = new Date(values.ends_at).getTime() - startsAt.getTime();
  const endsOn = new Date(`${recurrence.endsOn}T23:59:59`);
  const rows = [];
  let occurrence = new Date(startsAt);
  for (let index = 0; occurrence <= endsOn && index < 370; index += 1) {
    rows.push({
      ...values,
      starts_at: occurrence.toISOString(),
      ends_at: new Date(occurrence.getTime() + duration).toISOString(),
      recurrence_series_id: seriesId,
      recurrence_frequency: recurrence.frequency,
      recurrence_interval: recurrence.interval,
      recurrence_ends_on: recurrence.endsOn,
    });
    occurrence = nextOccurrence(occurrence, recurrence.frequency, recurrence.interval);
  }
  return rows;
}

function nextOccurrence(date: Date, frequency: RecurrenceInput["frequency"], interval: number) {
  const next = new Date(date);
  if (frequency === "daily") next.setDate(next.getDate() + interval);
  if (frequency === "weekly") next.setDate(next.getDate() + 7 * interval);
  if (frequency === "monthly") {
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + interval);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDay));
  }
  return next;
}

function withTime(date: Date, time: Date) {
  const value = new Date(date);
  value.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return value;
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
