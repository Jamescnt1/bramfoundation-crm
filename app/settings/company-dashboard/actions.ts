"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/services/employees";
import {
  updateCompanyDashboardRuleSettings,
  type DashboardRuleSetting,
} from "@/lib/services/dashboard-rule-settings";

export async function updateCompanyDashboardRulesAction(
  settings: DashboardRuleSetting[],
) {
  await requireAdministrator();
  const updated = await updateCompanyDashboardRuleSettings(settings);
  revalidatePath("/settings/company-dashboard");
  revalidatePath("/company");
  return updated;
}
