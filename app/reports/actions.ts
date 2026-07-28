"use server";

import { revalidatePath } from "next/cache";
import { getReportDefinition } from "@/lib/reports/definitions";
import { setReportFavorite } from "@/lib/services/reports";

export async function setReportFavoriteAction(reportId: string, favorite: boolean) {
  if (!getReportDefinition(reportId)) throw new Error("Report not found.");
  await setReportFavorite(reportId, favorite);
  revalidatePath("/reports");
}

