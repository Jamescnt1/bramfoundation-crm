import { createClient } from "@supabase/supabase-js";

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);
if (missingEnvironment.length) {
  console.error(`Missing environment variables: ${missingEnvironment.join(", ")}`);
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const requiredTables = [
  "appointments", "automation_rules", "company_settings",
  "communication_consents", "communication_deliveries", "communication_settings",
  "communication_templates", "communication_webhook_events", "communication_automation_events",
  "conversation_participants", "conversations", "customers",
  "employee_communication_preferences", "employee_notifications", "employees", "job_activities",
  "installer_contacts", "job_attachments", "job_tasks", "jobs", "lead_sources", "messages",
  "permission_definitions", "pipeline_stages", "role_definitions",
  "role_permissions", "task_types",
];
let failed = false;

for (const table of requiredTables) {
  const { error } = await admin.from(table).select("*", { head: true, count: "exact" });
  if (error) {
    failed = true;
    console.error(`FAIL table ${table}: ${error.message}`);
  } else console.log(`PASS table ${table}`);
}

const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
if (bucketError || !buckets?.some((bucket) => bucket.id === "job-attachments" && !bucket.public)) {
  failed = true;
  console.error("FAIL private storage bucket job-attachments");
} else console.log("PASS private storage bucket job-attachments");

const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const administrator = usersData?.users.find(
  (user) => user.email?.toLowerCase() === "virgilw@bramflooring.com",
);
if (usersError || !administrator) {
  failed = true;
  console.error("FAIL administrator Auth account virgilw@bramflooring.com");
} else {
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id, active, role, auth_user_id")
    .eq("auth_user_id", administrator.id)
    .maybeSingle();
  if (employeeError || !employee?.active || employee.role !== "administrator") {
    failed = true;
    console.error("FAIL active administrator employee link");
  } else console.log("PASS administrator Auth account and employee link");
}

for (const table of ["pipeline_stages", "lead_sources", "task_types", "role_definitions"]) {
  const { count, error } = await admin.from(table).select("*", { head: true, count: "exact" });
  if (error || !count) {
    failed = true;
    console.error(`FAIL required configuration data in ${table}`);
  } else console.log(`PASS ${table} configuration (${count} records)`);
}

const { data: communicationSettings, error: communicationSettingsError } = await admin
  .from("communication_settings")
  .select("sms_enabled,calendar_customer_notifications_enabled,calendar_employee_notifications_enabled,calendar_installer_notifications_enabled,appointment_reminder_hours_before,calendar_customer_reminder_channel,calendar_employee_reminder_channel,calendar_installer_reminder_channel")
  .eq("singleton_key", true)
  .single();
if (communicationSettingsError) {
  failed = true;
  console.error(`FAIL communication settings: ${communicationSettingsError.message}`);
} else if (communicationSettings.sms_enabled) {
  const requiredTwilioEnvironment = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_MESSAGING_SERVICE_SID",
    "TWILIO_WEBHOOK_BASE_URL",
  ];
  const missingTwilioEnvironment = requiredTwilioEnvironment.filter((key) => !process.env[key]);
  if (missingTwilioEnvironment.length) {
    failed = true;
    console.error(`FAIL enabled SMS is missing: ${missingTwilioEnvironment.join(", ")}`);
  } else console.log("PASS enabled SMS server configuration");
} else console.log("PASS SMS safely paused");

if (communicationSettings?.scheduled_communications_enabled && communicationSettings?.automated_communications_enabled) {
  if (!process.env.CRON_SECRET) {
    failed = true;
    console.error("FAIL enabled automated reminders are missing CRON_SECRET");
  } else console.log("PASS automated reminder scheduler authentication");
} else console.log("PASS automated reminders safely paused");

if (failed) process.exit(1);
console.log("Beta Supabase readiness audit passed.");
