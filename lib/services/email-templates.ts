import "server-only";

import type { EmailTemplate } from "@/components/email/types";
import { requirePermission } from "@/lib/services/employees";
import { sendProviderEmail } from "@/lib/services/email-provider";
import { getCompanySettings } from "@/lib/services/company-settings";
import { createAdminClient } from "@/lib/supabase/admin";

const columns = "id,name,category,subject,body,active,created_at,updated_at";
export type EmailTemplateValues = { name: string; category: string; subject: string; body: string; active: boolean };

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  await requirePermission("email_templates.manage");
  const { data, error } = await createAdminClient().from("email_templates").select(columns).order("category").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailTemplate[];
}
export async function saveEmailTemplate(id: string | null, values: EmailTemplateValues): Promise<EmailTemplate> {
  const actor = await requirePermission("email_templates.manage");
  const clean = normalize(values); const admin = createAdminClient();
  const query = id ? admin.from("email_templates").update(clean).eq("id", id) : admin.from("email_templates").insert({ ...clean, created_by_employee_id: actor.id });
  const { data, error } = await query.select(columns).single();
  if (error) throw new Error(error.message);
  return data as EmailTemplate;
}
export async function setEmailTemplateActive(id: string, active: boolean) {
  await requirePermission("email_templates.manage");
  const { error } = await createAdminClient().from("email_templates").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function sendEmailTemplateTest(input: { templateId: string; recipient: string }) {
  await requirePermission("email_templates.manage");
  const admin = createAdminClient();
  const { data, error } = await admin.from("email_templates").select("name,subject,body").eq("id", input.templateId).single();
  if (error) throw new Error(error.message);
  const company = await getCompanySettings(); const address = process.env.EMAIL_FROM_ADDRESS || company.email;
  if (!address) throw new Error("Set EMAIL_FROM_ADDRESS or the company email first.");
  const replace = (value: string) => value.replaceAll("{{customer_name}}", "Test Customer").replaceAll("{{job_name}}", "Test Flooring Project")
    .replaceAll("{{qf_number}}", "TEST-123").replaceAll("{{appointment_date}}", "August 15, 2026")
    .replaceAll("{{appointment_time}}", "9:00 AM").replaceAll("{{assigned_employee}}", "Test Employee")
    .replaceAll("{{company_name}}", company.company_name).replaceAll("{{company_phone}}", company.phone ?? "");
  return sendProviderEmail({ idempotencyKey: `template-test-${crypto.randomUUID()}`, from: `${company.company_name} <${address}>`,
    to: input.recipient, subject: `[TEST] ${replace(data.subject)}`, text: replace(data.body), replyTo: company.email });
}
function normalize(values: EmailTemplateValues) {
  const result = { name: values.name.trim(), category: values.category.trim() || "General", subject: values.subject.trim(), body: values.body.trim(), active: values.active };
  if (!result.name || !result.subject || !result.body) throw new Error("Name, subject, and body are required.");
  return result;
}
