import type {
  AppointmentStatus,
  AppointmentType,
} from "./constants";

export type CalendarAppointment = {
  id: string;
  job_id: string | null;
  assigned_employee_id: string | null;

  title: string | null;

  appointment_type: AppointmentType | null;

  starts_at: string;
  ends_at: string | null;

  status: AppointmentStatus | null;

  location: string | null;
  notes: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  assigned_employee?: {
    id: string;
    name: string;
  } | null;

  job?: {
    id: string;
    customer_id: string | null;
    customer_name: string;
    qfloors_job_number: string | null;
    status: string | null;
    customer: {
      id: string;
      full_name: string;
    } | null;
  } | null;
};

export type CalendarView = "month" | "week" | "three_day" | "day" | "list";
