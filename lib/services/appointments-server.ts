import "server-only";

import type { CalendarAppointment } from "@/components/calendar/types";
import { createClient } from "@/lib/supabase/server";

export async function getAppointmentsForCalendar(): Promise<CalendarAppointment[]> {
  const supabase = await createClient();
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
        phone,
        email,
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
    .order("starts_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as CalendarAppointment[];
}
