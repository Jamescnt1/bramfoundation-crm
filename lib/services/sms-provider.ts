import "server-only";

import twilio from "twilio";
import { getTwilioConfiguration } from "@/lib/twilio/config";

export async function sendProviderSms(input: { to: string; body: string }) {
  const configuration = getTwilioConfiguration();
  const client = twilio(configuration.accountSid, configuration.authToken);
  const message = await client.messages.create({
    to: input.to,
    messagingServiceSid: configuration.messagingServiceSid,
    statusCallback: `${configuration.webhookBaseUrl}/api/twilio/status`,
    ...(configuration.testContentSid
      ? { contentSid: configuration.testContentSid, contentVariables: JSON.stringify({}) }
      : { body: input.body }),
  });
  return { provider: "twilio", providerMessageId: message.sid, providerStatus: message.status };
}

export async function validateTwilioWebhook(request: Request, formData: FormData) {
  const configuration = getTwilioConfiguration();
  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;
  const parameters: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") parameters[key] = value;
  }
  const incomingUrl = new URL(request.url);
  const validationUrl = `${configuration.webhookBaseUrl}${incomingUrl.pathname}${incomingUrl.search}`;
  return twilio.validateRequest(configuration.authToken, signature, validationUrl, parameters);
}
