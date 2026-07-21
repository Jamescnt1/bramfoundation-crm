import "server-only";

import type { CustomerEmail, EmailTemplate } from "@/components/email/types";
import { getCompanySettings } from "@/lib/services/company-settings";
import { requirePermission } from "@/lib/services/employees";
import { sendProviderEmail } from "@/lib/services/email-provider";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "job-attachments";
const emailColumns = `id, job_id, customer_id, template_id, sent_by_employee_id, direction,
 sender, recipient, subject, body, status, is_automated, provider_message_id,
 failure_reason, sent_at, delivered_at, created_at,
 sent_by:employees!customer_emails_sent_by_employee_id_fkey(id,name)`;

export async function getJobCustomerEmails(jobId: string): Promise<CustomerEmail[]> {
  await requirePermission("customer_email.view");
  const admin = createAdminClient();
  const { data, error } = await admin.from("customer_emails").select(emailColumns)
    .eq("job_id", jobId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((email) => email.id);
  const { data: links, error: linkError } = ids.length
    ? await admin.from("customer_email_attachments").select("email_id, attachment:job_attachments(id,file_name,mime_type,storage_path)").in("email_id", ids)
    : { data: [], error: null };
  if (linkError) throw new Error(linkError.message);
  const paths = (links ?? []).flatMap((link) => {
    const item = Array.isArray(link.attachment) ? link.attachment[0] : link.attachment;
    return item?.storage_path ? [item.storage_path] : [];
  });
  const signed = paths.length ? await admin.storage.from(BUCKET).createSignedUrls(paths, 3600) : { data: [], error: null };
  if (signed.error) throw new Error(signed.error.message);
  const urls = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]));
  return (data ?? []).map((row) => ({
    ...row,
    sent_by: Array.isArray(row.sent_by) ? row.sent_by[0] ?? null : row.sent_by,
    attachments: (links ?? []).filter((link) => link.email_id === row.id).flatMap((link) => {
      const item = Array.isArray(link.attachment) ? link.attachment[0] : link.attachment;
      return item ? [{ id: item.id, file_name: item.file_name, mime_type: item.mime_type, signed_url: urls.get(item.storage_path) ?? "" }] : [];
    }),
  })) as CustomerEmail[];
}

export async function getActiveEmailTemplates(): Promise<EmailTemplate[]> {
  await requirePermission("customer_email.view");
  const admin = createAdminClient();
  const { data, error } = await admin.from("email_templates").select("id,name,category,subject,body,active,created_at,updated_at")
    .eq("active", true).order("category").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailTemplate[];
}

export async function sendCustomerEmail(input: {
  jobId: string; recipient: string; subject: string; body: string; templateId?: string | null;
  attachmentIds?: string[]; automated?: boolean; automationRuleId?: string | null;
}) {
  const actor = await requirePermission("customer_email.send");
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin.from("jobs")
    .select("id,customer_id,customer_name,qfloors_job_number").eq("id", input.jobId).is("archived_at", null).single();
  if (jobError) throw new Error(jobError.message);
  const recipient = input.recipient.trim(); let subject = input.subject.trim(); let body = input.body.trim();
  if (!/^\S+@\S+\.\S+$/.test(recipient)) throw new Error("Enter a valid customer email address.");
  if (!subject || !body) throw new Error("Subject and message are required.");
  const company = await getCompanySettings();
  if (input.templateId) {
    const [subjectResult, bodyResult] = await Promise.all([
      admin.rpc("render_email_merge_fields", { source: subject, target_job_id: input.jobId }),
      admin.rpc("render_email_merge_fields", { source: body, target_job_id: input.jobId }),
    ]);
    if (subjectResult.error || bodyResult.error) throw new Error(subjectResult.error?.message ?? bodyResult.error?.message ?? "Unable to merge the email template.");
    subject = subjectResult.data as string; body = bodyResult.data as string;
  }
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || company.email;
  if (!fromAddress) throw new Error("Set EMAIL_FROM_ADDRESS or the company email before sending customer email.");
  const from = `${process.env.EMAIL_FROM_NAME || company.company_name} <${fromAddress}>`;
  const { data: email, error } = await admin.from("customer_emails").insert({
    job_id: input.jobId, customer_id: job.customer_id, template_id: input.templateId || null,
    sent_by_employee_id: actor.id, direction: "outbound", sender: from, recipient,
    subject, body, status: "queued", is_automated: Boolean(input.automated),
    automation_rule_id: input.automationRuleId || null,
  }).select("id").single();
  if (error) throw new Error(error.message);
  try {
    const attachments = await loadAttachments(admin, input.jobId, input.attachmentIds ?? []);
    if (attachments.length) {
      const { error: attachmentError } = await admin.from("customer_email_attachments")
        .insert(attachments.map((item) => ({ email_id: email.id, attachment_id: item.id })));
      if (attachmentError) throw new Error(attachmentError.message);
    }
    const delivery = await sendProviderEmail({ idempotencyKey: `customer-email-${email.id}`, from, to: recipient,
      subject, text: body, replyTo: buildJobReplyAddress(input.jobId) ?? company.email, attachments: attachments.map((item) => ({ filename: item.file_name, content: item.content })) });
    const sentAt = new Date().toISOString();
    await admin.from("customer_emails").update({ status: "sent", provider: delivery.provider,
      provider_message_id: delivery.providerMessageId, sent_at: sentAt }).eq("id", email.id);
    await admin.from("job_activities").insert({ job_id: input.jobId, activity_type: "customer_email_sent",
      description: `${input.automated ? "Automated" : actor.name + " sent"} ${subject}.`, old_value: null, new_value: email.id });
    return { id: email.id, status: "sent" as const };
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "Email delivery failed.";
    await admin.from("customer_emails").update({ status: "failed", failure_reason: reason }).eq("id", email.id);
    throw new Error(reason);
  }
}

export async function deliverQueuedEmailsForJob(jobId: string) {
  const admin = createAdminClient();
  const company = await getCompanySettings();
  const configuredAddress = process.env.EMAIL_FROM_ADDRESS || company.email;
  const { data, error } = await admin.from("customer_emails")
    .select("id,sender,recipient,subject,body").eq("job_id", jobId).eq("status", "queued").order("created_at");
  if (error) throw new Error(error.message);
  for (const email of data ?? []) {
    try {
      if (!configuredAddress) throw new Error("Set EMAIL_FROM_ADDRESS or the company email before sending customer email.");
      const from = `${process.env.EMAIL_FROM_NAME || company.company_name} <${configuredAddress}>`;
      const delivery = await sendProviderEmail({ idempotencyKey: `customer-email-${email.id}`, from,
        to: email.recipient, subject: email.subject, text: email.body, replyTo: buildJobReplyAddress(jobId) });
      await admin.from("customer_emails").update({ status: "sent", provider: delivery.provider,
        provider_message_id: delivery.providerMessageId, sent_at: new Date().toISOString() }).eq("id", email.id);
      await admin.from("job_activities").insert({ job_id: jobId, activity_type: "customer_email_sent",
        description: `Automated ${email.subject} sent.`, old_value: null, new_value: email.id });
    } catch (caught) {
      await admin.from("customer_emails").update({ status: "failed", failure_reason: caught instanceof Error ? caught.message : "Delivery failed." }).eq("id", email.id);
    }
  }
}

function buildJobReplyAddress(jobId: string) {
  const domain = process.env.EMAIL_INBOUND_DOMAIN;
  return domain ? `job+${jobId}@${domain}` : null;
}

async function loadAttachments(admin: ReturnType<typeof createAdminClient>, jobId: string, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await admin.from("job_attachments").select("id,file_name,storage_path,file_size")
    .in("id", ids).eq("job_id", jobId).is("archived_at", null);
  if (error) throw new Error(error.message);
  const total = (data ?? []).reduce((sum, item) => sum + item.file_size, 0);
  if (total > 28 * 1024 * 1024) throw new Error("Selected attachments are too large for one email.");
  return Promise.all((data ?? []).map(async (item) => {
    const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(item.storage_path);
    if (downloadError) throw new Error(downloadError.message);
    return { ...item, content: Buffer.from(await file.arrayBuffer()).toString("base64") };
  }));
}
