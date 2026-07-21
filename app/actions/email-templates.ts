"use server";

import { revalidatePath } from "next/cache";
import { saveEmailTemplate, sendEmailTemplateTest, setEmailTemplateActive, type EmailTemplateValues } from "@/lib/services/email-templates";

export async function saveTemplate(id: string | null, values: EmailTemplateValues) {
  const result = await saveEmailTemplate(id, values); revalidatePath("/settings/email-templates"); return result;
}
export async function toggleTemplate(id: string, active: boolean) {
  await setEmailTemplateActive(id, active); revalidatePath("/settings/email-templates");
}
export async function testTemplate(templateId: string, recipient: string) { return sendEmailTemplateTest({ templateId, recipient }); }
