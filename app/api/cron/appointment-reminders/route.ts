import { processScheduledAppointmentReminders } from "@/lib/services/appointment-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processScheduledAppointmentReminders();
    return Response.json({ success: true, ...result });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to process appointment reminders.";
    console.error("Appointment reminder cron failed", caught);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
