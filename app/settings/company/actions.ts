"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/services/employees";
import {
  updateCompanySettings,
  type CompanySettingsValues,
} from "@/lib/services/company-settings";

export async function updateCompanySettingsAction(
  id: string,
  values: CompanySettingsValues,
) {
  await requireAdministrator();
  const settings = await updateCompanySettings(id, values);
  revalidatePath("/settings/company");
  return settings;
}
