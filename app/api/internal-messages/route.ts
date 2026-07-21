import {
  createConversation,
  createTaskFromMessage,
  editInternalMessage,
  getConversation,
  markConversationRead,
  sendInternalMessage,
} from "@/lib/services/internal-messaging";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("conversationId");
    if (!id) return Response.json({ error: "Conversation is required." }, { status: 400 });
    return Response.json({ conversation: await getConversation(id) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "create_conversation") {
      return Response.json({ conversation: await createConversation({ type: body.type, title: body.title, participantIds: body.participantIds ?? [] }) });
    }
    if (body.action === "send") {
      const message = await sendInternalMessage({ conversationId: body.conversationId, jobId: body.jobId, body: body.body, mentionedEmployeeIds: body.mentionedEmployeeIds, attachmentIds: body.attachmentIds });
      return Response.json({ message, conversationId: message.conversation_id });
    }
    if (body.action === "read") {
      await markConversationRead(body.conversationId);
      return Response.json({ ok: true });
    }
    if (body.action === "task") {
      return Response.json({ taskId: await createTaskFromMessage({ messageId: body.messageId, title: body.title }) });
    }
    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    await editInternalMessage(body.messageId, body.body);
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to complete the messaging request.";
  const status = /access|authorized|own messages/i.test(message) ? 403 : 400;
  return Response.json({ error: message }, { status });
}
