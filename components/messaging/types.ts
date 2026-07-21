export type ConversationType = "internal_direct" | "internal_job" | "internal_group";

export type MessagingEmployee = {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string;
};

export type MessageAttachment = {
  id: string;
  file_name: string;
  attachment_kind: "photo" | "file";
  signed_url: string;
};

export type InternalMessage = {
  id: string;
  conversation_id: string;
  sender_employee_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  sender: MessagingEmployee;
  attachments: MessageAttachment[];
  task_id: string | null;
};

export type ConversationSummary = {
  id: string;
  conversation_type: ConversationType;
  title: string;
  job_id: string | null;
  job_label: string | null;
  last_message_at: string | null;
  last_message: string | null;
  participants: MessagingEmployee[];
  unread_count: number;
  mention_count: number;
};

export type InternalConversation = ConversationSummary & {
  messages: InternalMessage[];
};
