import "server-only";

export type TwilioConfiguration = {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string;
  webhookBaseUrl: string;
  testContentSid: string | null;
};

export function getTwilioConfiguration(environment: NodeJS.ProcessEnv = process.env): TwilioConfiguration {
  const accountSid = environment.TWILIO_ACCOUNT_SID;
  const authToken = environment.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = environment.TWILIO_MESSAGING_SERVICE_SID;
  const webhookBaseUrl = environment.TWILIO_WEBHOOK_BASE_URL?.replace(/\/$/, "");
  if (!accountSid || !authToken || !messagingServiceSid || !webhookBaseUrl) {
    throw new Error("Twilio is not fully configured. Add the account SID, auth token, Messaging Service SID, and webhook base URL.");
  }
  if (!webhookBaseUrl.startsWith("https://")) throw new Error("The Twilio webhook base URL must use HTTPS.");
  return { accountSid, authToken, messagingServiceSid, webhookBaseUrl, testContentSid: environment.TWILIO_TEST_CONTENT_SID || null };
}

export function getTwilioConfigurationStatus(environment: NodeJS.ProcessEnv = process.env) {
  const fields = {
    accountSid: Boolean(environment.TWILIO_ACCOUNT_SID),
    authToken: Boolean(environment.TWILIO_AUTH_TOKEN),
    messagingServiceSid: Boolean(environment.TWILIO_MESSAGING_SERVICE_SID),
    webhookBaseUrl: Boolean(environment.TWILIO_WEBHOOK_BASE_URL),
    testContentSid: Boolean(environment.TWILIO_TEST_CONTENT_SID),
  };
  return { ...fields, configured: fields.accountSid && fields.authToken && fields.messagingServiceSid && fields.webhookBaseUrl };
}
