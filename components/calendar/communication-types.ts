export type AppointmentNotificationAudience = "customer" | "employee" | "installer";
export type AppointmentNotificationChannel = "email" | "sms";
export type AppointmentNotificationKind = "confirmation" | "reminder";

export type AppointmentNotificationDelivery = {
  id: string;
  appointment_id: string;
  direction: "inbound" | "outbound";
  recipient_type: AppointmentNotificationAudience;
  recipient_address: string;
  sender_address: string | null;
  body: string;
  subject: string | null;
  channel: AppointmentNotificationChannel;
  status: string;
  failure_reason: string | null;
  provider_error_code: string | null;
  created_at: string;
};

export type CalendarCommunicationData = {
  controls: {
    customer: boolean;
    employee: boolean;
    installer: boolean;
    email: boolean;
    sms: boolean;
  };
  deliveriesByAppointment: Record<string, AppointmentNotificationDelivery[]>;
};
