"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/services/employees";
import { createAdminClient } from "@/lib/supabase/admin";

type FollowUpPreferences = {
  leadFollowupsEnabled: boolean;
  estimateFollowupsEnabled: boolean;
};

export async function updateCustomerFollowUpPreferencesAction(
  customerId: string,
  preferences: FollowUpPreferences,
) {
  await requirePermission("customers.manage");
  if (!isUuid(customerId)) throw new Error("The customer selection is invalid.");
  if (
    typeof preferences.leadFollowupsEnabled !== "boolean" ||
    typeof preferences.estimateFollowupsEnabled !== "boolean"
  ) {
    throw new Error("The follow-up preferences are invalid.");
  }

  const admin = createAdminClient();
  const { data: customer, error: updateError } = await admin
    .from("customers")
    .update({
      lead_followups_enabled: preferences.leadFollowupsEnabled,
      estimate_followups_enabled: preferences.estimateFollowupsEnabled,
    })
    .eq("id", customerId)
    .is("archived_at", null)
    .select("id, lead_followups_enabled, estimate_followups_enabled")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!customer) throw new Error("The customer could not be found.");

  await cancelDisabledAutomatedFollowUps(admin, customerId, preferences);

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/tasks");
  revalidatePath("/my-dashboard");
  revalidatePath("/company");

  return {
    leadFollowupsEnabled: customer.lead_followups_enabled,
    estimateFollowupsEnabled: customer.estimate_followups_enabled,
  };
}

async function cancelDisabledAutomatedFollowUps(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  preferences: FollowUpPreferences,
) {
  if (preferences.leadFollowupsEnabled && preferences.estimateFollowupsEnabled) return;

  const [{ data: rules, error: rulesError }, { data: jobs, error: jobsError }] = await Promise.all([
    admin.from("automation_rules").select("id, trigger_event, trigger_value"),
    admin.from("jobs").select("id").eq("customer_id", customerId),
  ]);
  if (rulesError) throw new Error(rulesError.message);
  if (jobsError) throw new Error(jobsError.message);

  const disabledRuleIds = (rules ?? []).flatMap((rule) => {
    const value = (rule.trigger_value ?? "").toLowerCase().replaceAll(" ", "_");
    const isLead = rule.trigger_event === "lead_untouched_daily" ||
      (rule.trigger_event === "job_status_changed" && value === "new_lead");
    const isEstimate = rule.trigger_event === "job_status_changed" && value === "estimate_sent";
    return ((!preferences.leadFollowupsEnabled && isLead) ||
      (!preferences.estimateFollowupsEnabled && isEstimate)) ? [rule.id] : [];
  });
  if (!disabledRuleIds.length) return;

  const updates = [
    admin.from("job_tasks")
      .update({ status: "cancelled", snoozed_until: null })
      .eq("customer_id", customerId)
      .in("automation_rule_id", disabledRuleIds)
      .in("status", ["open", "in_progress", "waiting"]),
  ];
  const jobIds = (jobs ?? []).map((job) => job.id);
  if (jobIds.length) {
    updates.push(
      admin.from("job_tasks")
        .update({ status: "cancelled", snoozed_until: null })
        .in("job_id", jobIds)
        .in("automation_rule_id", disabledRuleIds)
        .in("status", ["open", "in_progress", "waiting"]),
    );
  }

  const results = await Promise.all(updates);
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
