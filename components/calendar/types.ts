import type {
  AppointmentStatus,
  AppointmentType,
} from "./constants";

export type CalendarAppointment = {
  id: string;
  job_id: string | null;
  assigned_employee_id: string | null;
  installer_crew_id: string | null;
  all_day: boolean;
  recurrence_series_id: string | null;
  recurrence_frequency: "daily" | "weekly" | "monthly" | null;
  recurrence_interval: number | null;
  recurrence_ends_on: string | null;
  copied_from_id: string | null;

  title: string | null;

  appointment_type: AppointmentType | null;
  appointment_type_record?: {
    key: string;
    name: string;
    active: boolean;
  } | null;

  starts_at: string;
  ends_at: string | null;

  status: AppointmentStatus | null;

  location: string | null;
  notes: string | null;
  installation_scope: string | null;
  work_order_status: "not_sent" | "sent" | "acknowledged";
  work_order_sent_at: string | null;
  work_order_sent_by: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  assigned_employee?: {
    id: string;
    name: string;
    color: string;
  } | null;

  installer_crew?: {
    id: string;
    name: string;
    color: string;
  } | null;

  work_order_sender?: {
    id: string;
    name: string;
  } | null;

  job?: {
    id: string;
    customer_id: string | null;
    customer_name: string;
    project_customer_name: string | null;
    project_contact_name: string | null;
    project_contact_phone: string | null;
    project_contact_description: string | null;
    phone: string | null;
    email: string | null;
    qfloors_job_number: string | null;
    address: string | null;
    lock_box_code: string | null;
    status: string | null;
    installation_required: boolean;
    customer: {
      id: string;
      full_name: string;
    } | null;
    company_contact: {
      first_name: string;
      last_name: string;
      job_title: string | null;
      email: string | null;
      office_phone: string | null;
      mobile_phone: string | null;
    } | null;
    project_contact: {
      first_name: string;
      last_name: string;
      job_title: string | null;
      email: string | null;
      office_phone: string | null;
      mobile_phone: string | null;
    } | null;
    job_site_contact: {
      first_name: string;
      last_name: string;
      job_title: string | null;
      email: string | null;
      office_phone: string | null;
      mobile_phone: string | null;
    } | null;
  } | null;
};

export type CalendarView = "month" | "week" | "three_day" | "day" | "list";
