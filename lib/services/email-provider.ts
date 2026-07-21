import "server-only";

export type DeliveryAttachment = { filename: string; content: string };
export type SendEmailInput = {
  idempotencyKey: string; from: string; to: string; subject: string; text: string;
  replyTo?: string | null; attachments?: DeliveryAttachment[];
};

export async function sendProviderEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Customer email is not configured. Add RESEND_API_KEY to the server environment.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.from, to: [input.to], subject: input.subject, text: input.text,
      reply_to: input.replyTo || undefined,
      attachments: input.attachments?.map((attachment) => ({ filename: attachment.filename, content: attachment.content })),
    }),
  });
  const payload = (await response.json()) as { id?: string; message?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) throw new Error(payload.message ?? payload.error?.message ?? "The email provider rejected the message.");
  return { provider: "resend", providerMessageId: payload.id };
}
