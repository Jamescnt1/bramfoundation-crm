import "server-only";

import { formatJobDisplayName } from "@/lib/job-display";
import type {
  ConversationSummary,
  ConversationType,
  InternalConversation,
  InternalMessage,
  MessageAttachment,
  MessagingEmployee,
} from "@/components/messaging/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEmployee } from "@/lib/services/employees";

type Admin = ReturnType<typeof createAdminClient>;

export async function getMessagingEmployees(): Promise<MessagingEmployee[]> {
  await requireEmployee();
  const admin = createAdminClient();
  const { data, error } = await admin.from("employees").select("id, name, avatar_url, color").eq("active", true).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as MessagingEmployee[];
}

export async function getEmployeeConversations(): Promise<ConversationSummary[]> {
  const actor = await requireEmployee();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("conversations")
    .select("id, conversation_type, title, job_id, last_message_at, created_at")
    .is("archived_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);

  const accessible = [];
  for (const row of data ?? []) {
    if (await canAccessConversation(admin, actor, row)) accessible.push(row);
  }
  return Promise.all(accessible.map((row) => buildSummary(admin, actor.id, row)));
}

export async function getJobConversation(jobId: string): Promise<InternalConversation | null> {
  const actor = await requireEmployee();
  const admin = createAdminClient();
  await requireJobAccess(admin, actor, jobId);
  const { data, error } = await admin
    .from("conversations")
    .select("id, conversation_type, title, job_id, last_message_at, created_at")
    .eq("conversation_type", "internal_job")
    .eq("job_id", jobId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return getConversationByRow(admin, actor.id, data);
}

export async function getConversation(conversationId: string): Promise<InternalConversation> {
  const actor = await requireEmployee();
  const admin = createAdminClient();
  const row = await requireConversationAccess(admin, actor, conversationId);
  return getConversationByRow(admin, actor.id, row);
}

export async function createConversation(input: {
  type: Exclude<ConversationType, "internal_job">;
  title?: string;
  participantIds: string[];
}) {
  const actor = await requireEmployee();
  const admin = createAdminClient();
  const participantIds = [...new Set([actor.id, ...input.participantIds])];
  if (input.type === "internal_direct" && participantIds.length !== 2) throw new Error("Choose one employee for a direct conversation.");
  if (input.type === "internal_group" && participantIds.length < 3) throw new Error("Choose at least two other employees for a group conversation.");
  await requireActiveEmployees(admin, participantIds);

  if (input.type === "internal_direct") {
    const existing = await findDirectConversation(admin, participantIds);
    if (existing) return getConversation(existing.id);
  }

  const title = input.type === "internal_group" ? input.title?.trim() : null;
  if (input.type === "internal_group" && !title) throw new Error("Group name is required.");
  const { data, error } = await admin.from("conversations").insert({
    conversation_type: input.type,
    title,
    created_by_employee_id: actor.id,
  }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: participantError } = await admin.from("conversation_participants").insert(
    participantIds.map((employeeId) => ({ conversation_id: data.id, employee_id: employeeId, last_read_at: employeeId === actor.id ? new Date().toISOString() : null })),
  );
  if (participantError) throw new Error(participantError.message);
  return getConversation(data.id);
}

export async function sendInternalMessage(input: {
  conversationId?: string | null;
  jobId?: string | null;
  body: string;
  mentionedEmployeeIds?: string[];
  attachmentIds?: string[];
}): Promise<InternalMessage> {
  const actor = await requireEmployee();
  const admin = createAdminClient();
  const body = input.body.trim();
  if (!body || body.length > 10000) throw new Error("Message must be between 1 and 10,000 characters.");

  let conversationId = input.conversationId ?? null;
  if (!conversationId && input.jobId) conversationId = await ensureJobConversation(admin, actor, input.jobId);
  if (!conversationId) throw new Error("Conversation is required.");
  const conversation = await requireConversationAccess(admin, actor, conversationId);

  const { data: message, error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_employee_id: actor.id,
    channel: "internal",
    body,
  }).select("id, conversation_id, sender_employee_id, body, created_at, updated_at, edited_at").single();
  if (error) throw new Error(error.message);

  const attachmentIds = [...new Set(input.attachmentIds ?? [])];
  if (attachmentIds.length) {
    if (!conversation.job_id) throw new Error("Attachments can only be linked in a job conversation.");
    await requireJobAttachments(admin, conversation.job_id, attachmentIds);
    const { error: attachmentError } = await admin.from("message_attachments").insert(
      attachmentIds.map((attachmentId) => ({ message_id: message.id, attachment_id: attachmentId })),
    );
    if (attachmentError) throw new Error(attachmentError.message);
  }

  const mentionIds = [...new Set(input.mentionedEmployeeIds ?? [])].filter((id) => id !== actor.id);
  if (mentionIds.length) {
    await requireMentionAccess(admin, conversation, mentionIds);
    const { error: mentionError } = await admin.from("message_mentions").insert(
      mentionIds.map((employeeId) => ({ message_id: message.id, employee_id: employeeId })),
    );
    if (mentionError) throw new Error(mentionError.message);
  }

  await admin.from("conversations").update({ last_message_at: message.created_at, updated_at: message.created_at }).eq("id", conversationId);
  await upsertReadState(admin, conversationId, actor.id, message.created_at);
  await createMessageNotifications(admin, conversation, actor, message.id, mentionIds);
  if (conversation.job_id) {
    await admin.from("job_activities").insert({
      job_id: conversation.job_id,
      activity_type: "internal_job_message_added",
      description: `${actor.name} added an internal job note.`,
      old_value: null,
      new_value: message.id,
    });
  }
  return hydrateMessage(admin, message);
}

export async function editInternalMessage(messageId: string, bodyValue: string) {
  const actor = await requireEmployee();
  const admin = createAdminClient();
  const body = bodyValue.trim();
  if (!body || body.length > 10000) throw new Error("Message must be between 1 and 10,000 characters.");
  const { data: message, error: findError } = await admin.from("messages").select("id, conversation_id, sender_employee_id").eq("id", messageId).is("deleted_at", null).maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!message || message.sender_employee_id !== actor.id) throw new Error("You can only edit your own messages.");
  await requireConversationAccess(admin, actor, message.conversation_id);
  const now = new Date().toISOString();
  const { error } = await admin.from("messages").update({ body, edited_at: now, updated_at: now }).eq("id", messageId);
  if (error) throw new Error(error.message);
}

export async function markConversationRead(conversationId: string) {
  const actor = await requireEmployee();
  const admin = createAdminClient();
  await requireConversationAccess(admin, actor, conversationId);
  const now = new Date().toISOString();
  await upsertReadState(admin, conversationId, actor.id, now);
  const messageIds = (await admin.from("messages").select("id").eq("conversation_id", conversationId)).data?.map((item) => item.id) ?? [];
  if (messageIds.length) {
    await admin.from("message_mentions").update({ read_at: now }).eq("employee_id", actor.id).is("read_at", null).in("message_id", messageIds);
  }
  await admin.from("employee_notifications").update({ read_at: now }).eq("employee_id", actor.id).eq("conversation_id", conversationId).is("read_at", null);
}

export async function createTaskFromMessage(input: { messageId: string; title?: string }) {
  const actor = await requireEmployee();
  const admin = createAdminClient();
  const { data: message, error } = await admin.from("messages").select("id, body, conversation_id").eq("id", input.messageId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!message) throw new Error("Message not found.");
  const conversation = await requireConversationAccess(admin, actor, message.conversation_id);
  const { data: existing } = await admin.from("message_task_links").select("task_id").eq("message_id", message.id).maybeSingle();
  if (existing) return existing.task_id as string;
  let customerId: string | null = null;
  if (conversation.job_id) {
    const { data: job } = await admin.from("jobs").select("customer_id").eq("id", conversation.job_id).single();
    customerId = job?.customer_id ?? null;
  }
  const title = input.title?.trim() || message.body.slice(0, 120);
  const { data: task, error: taskError } = await admin.from("job_tasks").insert({
    job_id: conversation.job_id,
    customer_id: customerId,
    title,
    description: `Created from an internal message: ${message.body}`,
    assigned_employee_id: actor.id,
    assigned_to: actor.name,
    priority: "normal",
    status: "open",
    source_message_id: message.id,
  }).select("id").single();
  if (taskError) throw new Error(taskError.message);
  const { error: linkError } = await admin.from("message_task_links").insert({ message_id: message.id, task_id: task.id });
  if (linkError) throw new Error(linkError.message);
  return task.id as string;
}

async function getConversationByRow(admin: Admin, employeeId: string, row: Record<string, unknown>): Promise<InternalConversation> {
  const [summary, messages] = await Promise.all([
    buildSummary(admin, employeeId, row),
    getMessages(admin, row.id as string),
  ]);
  return { ...summary, messages };
}

async function getMessages(admin: Admin, conversationId: string): Promise<InternalMessage[]> {
  const { data, error } = await admin.from("messages")
    .select("id, conversation_id, sender_employee_id, body, created_at, updated_at, edited_at, sender:employees!messages_sender_employee_id_fkey(id, name, avatar_url, color)")
    .eq("conversation_id", conversationId).is("deleted_at", null).order("created_at");
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map((row) => hydrateMessage(admin, row)));
}

async function hydrateMessage(admin: Admin, row: Record<string, unknown>): Promise<InternalMessage> {
  const { data: attachmentLinks } = await admin.from("message_attachments").select("attachment_id").eq("message_id", row.id as string);
  const attachmentIds = (attachmentLinks ?? []).map((item) => item.attachment_id);
  let attachments: MessageAttachment[] = [];
  if (attachmentIds.length) {
    const { data } = await admin.from("job_attachments").select("id, file_name, attachment_kind, storage_path").in("id", attachmentIds).is("archived_at", null);
    const rows = data ?? [];
    const { data: signed } = await admin.storage.from("job-attachments").createSignedUrls(rows.map((item) => item.storage_path), 3600);
    const urls = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
    attachments = rows.map((item) => ({ id: item.id, file_name: item.file_name, attachment_kind: item.attachment_kind, signed_url: urls.get(item.storage_path) ?? "" })) as MessageAttachment[];
  }
  const { data: taskLink } = await admin.from("message_task_links").select("task_id").eq("message_id", row.id as string).maybeSingle();
  const senderValue = row.sender;
  const sender = (Array.isArray(senderValue) ? senderValue[0] : senderValue) as MessagingEmployee;
  return { ...row, sender, attachments, task_id: taskLink?.task_id ?? null } as InternalMessage;
}

async function buildSummary(admin: Admin, employeeId: string, row: Record<string, unknown>): Promise<ConversationSummary> {
  const conversationId = row.id as string;
  const [{ data: participantRows }, { data: readState }, { count: mentionCount }, { data: latest }, job] = await Promise.all([
    admin.from("conversation_participants").select("employee:employees(id, name, avatar_url, color)").eq("conversation_id", conversationId),
    admin.from("conversation_participants").select("last_read_at").eq("conversation_id", conversationId).eq("employee_id", employeeId).maybeSingle(),
    admin.from("message_mentions").select("message:messages!inner(conversation_id)", { count: "exact", head: true }).eq("employee_id", employeeId).is("read_at", null).eq("messages.conversation_id", conversationId),
    admin.from("messages").select("body, created_at").eq("conversation_id", conversationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    row.job_id ? admin.from("jobs").select("customer_name, qfloors_job_number, customer:customers!jobs_customer_id_fkey(full_name)").eq("id", row.job_id as string).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const participants = (participantRows ?? []).map((item) => Array.isArray(item.employee) ? item.employee[0] : item.employee).filter(Boolean) as MessagingEmployee[];
  const lastRead = readState?.last_read_at ?? "1970-01-01T00:00:00.000Z";
  const { count: unreadCount } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId).neq("sender_employee_id", employeeId).gt("created_at", lastRead).is("deleted_at", null);
  const jobData = "data" in job ? job.data : null;
  const customerValue = jobData?.customer;
  const customer = Array.isArray(customerValue) ? customerValue[0] : customerValue;
  const jobLabel = jobData ? formatJobDisplayName({ customerName: customer?.full_name, jobName: jobData.customer_name, qfNumber: jobData.qfloors_job_number }) : null;
  const type = row.conversation_type as ConversationType;
  const directName = participants.find((item) => item.id !== employeeId)?.name;
  return {
    id: conversationId,
    conversation_type: type,
    title: type === "internal_job" ? jobLabel ?? "Job discussion" : type === "internal_direct" ? directName ?? "Direct message" : (row.title as string | null) ?? "Group conversation",
    job_id: (row.job_id as string | null) ?? null,
    job_label: jobLabel,
    last_message_at: (latest?.created_at as string | null) ?? (row.last_message_at as string | null) ?? null,
    last_message: (latest?.body as string | null) ?? null,
    participants,
    unread_count: unreadCount ?? 0,
    mention_count: mentionCount ?? 0,
  };
}

async function ensureJobConversation(admin: Admin, actor: { id: string; name: string; role: string }, jobId: string) {
  await requireJobAccess(admin, actor, jobId);
  const { data: existing } = await admin.from("conversations").select("id").eq("conversation_type", "internal_job").eq("job_id", jobId).is("archived_at", null).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin.from("conversations").insert({ conversation_type: "internal_job", job_id: jobId, created_by_employee_id: actor.id }).select("id").single();
  if (error?.code === "23505") {
    const { data: concurrent } = await admin.from("conversations").select("id").eq("conversation_type", "internal_job").eq("job_id", jobId).is("archived_at", null).single();
    return concurrent!.id as string;
  }
  if (error) throw new Error(error.message);
  await admin.from("conversation_participants").upsert({ conversation_id: data.id, employee_id: actor.id, last_read_at: new Date().toISOString() });
  return data.id as string;
}

async function requireConversationAccess(admin: Admin, actor: { id: string; name: string; role: string }, conversationId: string) {
  const { data, error } = await admin.from("conversations").select("id, conversation_type, title, job_id, last_message_at, created_at").eq("id", conversationId).is("archived_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !(await canAccessConversation(admin, actor, data))) throw new Error("You do not have access to this internal conversation.");
  return data;
}

async function canAccessConversation(admin: Admin, actor: { id: string; name: string; role: string }, conversation: Record<string, unknown>) {
  if (conversation.conversation_type === "internal_job") {
    try { await requireJobAccess(admin, actor, conversation.job_id as string); return true; } catch { return false; }
  }
  const { data } = await admin.from("conversation_participants").select("employee_id").eq("conversation_id", conversation.id as string).eq("employee_id", actor.id).maybeSingle();
  return Boolean(data);
}

async function requireJobAccess(admin: Admin, actor: { id: string; name: string; role: string }, jobId: string) {
  const { data, error } = await admin.from("jobs").select("id, assigned_employee_id, salesperson").eq("id", jobId).is("archived_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  const broad = ["administrator", "sales_manager", "operations_manager", "office_staff"].includes(actor.role);
  if (!data || (!broad && data.assigned_employee_id !== actor.id && data.salesperson?.toLowerCase() !== actor.name.toLowerCase())) throw new Error("You do not have access to this job discussion.");
}

async function findDirectConversation(admin: Admin, participantIds: string[]) {
  const { data } = await admin.from("conversation_participants").select("conversation_id").in("employee_id", participantIds);
  const counts = new Map<string, number>();
  for (const item of data ?? []) counts.set(item.conversation_id, (counts.get(item.conversation_id) ?? 0) + 1);
  for (const [conversationId, count] of counts) {
    if (count !== participantIds.length) continue;
    const [{ data: conversation }, { count: total }] = await Promise.all([
      admin.from("conversations").select("id, conversation_type").eq("id", conversationId).eq("conversation_type", "internal_direct").is("archived_at", null).maybeSingle(),
      admin.from("conversation_participants").select("employee_id", { count: "exact", head: true }).eq("conversation_id", conversationId),
    ]);
    if (conversation && total === 2) return conversation;
  }
  return null;
}

async function requireActiveEmployees(admin: Admin, ids: string[]) {
  const { data, error } = await admin.from("employees").select("id").in("id", ids).eq("active", true);
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== ids.length) throw new Error("One or more selected employees are unavailable.");
}

async function requireMentionAccess(admin: Admin, conversation: Record<string, unknown>, ids: string[]) {
  await requireActiveEmployees(admin, ids);
  if (conversation.conversation_type === "internal_job") return;
  const { data } = await admin.from("conversation_participants").select("employee_id").eq("conversation_id", conversation.id as string).in("employee_id", ids);
  if ((data ?? []).length !== ids.length) throw new Error("You can only mention employees in this conversation.");
}

async function requireJobAttachments(admin: Admin, jobId: string, ids: string[]) {
  const { data, error } = await admin.from("job_attachments").select("id").eq("job_id", jobId).in("id", ids).is("archived_at", null);
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== ids.length) throw new Error("One or more attachments are unavailable for this job.");
}

async function upsertReadState(admin: Admin, conversationId: string, employeeId: string, value: string) {
  const { error } = await admin.from("conversation_participants").upsert({ conversation_id: conversationId, employee_id: employeeId, last_read_at: value }, { onConflict: "conversation_id,employee_id" });
  if (error) throw new Error(error.message);
}

async function createMessageNotifications(admin: Admin, conversation: Record<string, unknown>, actor: { id: string; name: string }, messageId: string, mentionIds: string[]) {
  let recipients: string[] = [];
  if (conversation.conversation_type === "internal_job") {
    const { data: job } = await admin.from("jobs").select("assigned_employee_id, salesperson").eq("id", conversation.job_id as string).single();
    const { data: managers } = await admin.from("employees").select("id").eq("active", true).in("role", ["administrator", "sales_manager", "operations_manager", "office_staff"]);
    const { data: salesperson } = job?.salesperson ? await admin.from("employees").select("id").eq("active", true).ilike("name", job.salesperson).maybeSingle() : { data: null };
    recipients = [...(managers ?? []).map((item) => item.id), job?.assigned_employee_id, salesperson?.id].filter(Boolean) as string[];
  } else {
    const { data } = await admin.from("conversation_participants").select("employee_id").eq("conversation_id", conversation.id as string);
    recipients = (data ?? []).map((item) => item.employee_id);
  }
  recipients = [...new Set([...recipients, ...mentionIds])].filter((id) => id !== actor.id);
  if (!recipients.length) return;
  const mentionSet = new Set(mentionIds);
  const { error } = await admin.from("employee_notifications").insert(recipients.flatMap((employeeId) => {
    const base = [{ employee_id: employeeId, notification_type: "message", conversation_id: conversation.id, message_id: messageId, title: `${actor.name} sent an internal message` }];
    if (mentionSet.has(employeeId)) base.push({ employee_id: employeeId, notification_type: "mention", conversation_id: conversation.id, message_id: messageId, title: `${actor.name} mentioned you` });
    return base;
  }));
  if (error) throw new Error(error.message);
}
