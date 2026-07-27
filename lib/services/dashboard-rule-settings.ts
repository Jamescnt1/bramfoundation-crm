import "server-only";

import {
  DASHBOARD_RULES,
  getDashboardRuleDefinition,
  getDashboardRuleThreshold,
  type DashboardRuleGroup,
  type DashboardRuleKey,
  type DashboardRuleSeverity,
} from "@/lib/dashboard-rules";
import { createClient } from "@/lib/supabase/server";

export type DashboardRuleSetting = {
  id: string | null;
  ruleKey: DashboardRuleKey;
  group: DashboardRuleGroup;
  enabled: boolean;
  severity: DashboardRuleSeverity;
  configuration: Record<string, number>;
};

type DashboardRuleRow = {
  id: string;
  rule_key: string;
  rule_group: DashboardRuleGroup;
  enabled: boolean;
  severity: DashboardRuleSeverity;
  configuration: Record<string, number> | null;
};

export async function getCompanyDashboardRuleSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dashboard_rule_settings")
    .select("id, rule_key, rule_group, enabled, severity, configuration")
    .is("employee_id", null);

  if (error) throw new Error(error.message);
  const saved = new Map(
    ((data ?? []) as DashboardRuleRow[]).map((row) => [row.rule_key, row]),
  );

  return DASHBOARD_RULES.map((definition) => {
    const row = saved.get(definition.key);
    const threshold = getDashboardRuleThreshold(definition);
    return {
      id: row?.id ?? null,
      ruleKey: definition.key,
      group: definition.group,
      enabled: row?.enabled ?? definition.defaultEnabled,
      severity: row?.severity ?? definition.defaultSeverity,
      configuration: {
        ...(threshold
          ? { [threshold.key]: threshold.defaultValue }
          : {}),
        ...(row?.configuration ?? {}),
      },
    } satisfies DashboardRuleSetting;
  });
}

export async function updateCompanyDashboardRuleSettings(
  values: DashboardRuleSetting[],
) {
  const supabase = await createClient();
  const existing = await getCompanyDashboardRuleSettings();
  const existingByKey = new Map(existing.map((setting) => [setting.ruleKey, setting]));

  for (const value of values) {
    const definition = getDashboardRuleDefinition(value.ruleKey);
    if (!definition || definition.group !== value.group) {
      throw new Error(`Unknown dashboard rule: ${value.ruleKey}`);
    }

    const configuration: Record<string, number> = {};
    const threshold = getDashboardRuleThreshold(definition);
    if (threshold) {
      const raw = Number(value.configuration[threshold.key]);
      configuration[threshold.key] = Math.min(
        threshold.maximum,
        Math.max(
          threshold.minimum,
          Number.isFinite(raw) ? Math.trunc(raw) : threshold.defaultValue,
        ),
      );
    }

    const payload = {
      rule_key: definition.key,
      rule_group: definition.group,
      employee_id: null,
      enabled: Boolean(value.enabled),
      severity: value.severity,
      configuration,
    };
    const current = existingByKey.get(value.ruleKey);
    const result = current?.id
      ? await supabase
          .from("dashboard_rule_settings")
          .update(payload)
          .eq("id", current.id)
      : await supabase.from("dashboard_rule_settings").insert(payload);

    if (result.error) throw new Error(result.error.message);
  }

  return getCompanyDashboardRuleSettings();
}

export function enabledRuleMap(settings: DashboardRuleSetting[]) {
  return new Map(
    settings.filter((setting) => setting.enabled).map((setting) => [setting.ruleKey, setting]),
  );
}
