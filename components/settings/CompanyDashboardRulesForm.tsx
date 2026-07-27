"use client";

import { useState } from "react";
import { updateCompanyDashboardRulesAction } from "@/app/settings/company-dashboard/actions";
import {
  DASHBOARD_RULES,
  getDashboardRuleThreshold,
  type DashboardRuleGroup,
  type DashboardRuleSeverity,
} from "@/lib/dashboard-rules";
import type { DashboardRuleSetting } from "@/lib/services/dashboard-rule-settings";
import { Button } from "@/components/ui/button";

const groups: Array<{
  key: DashboardRuleGroup;
  title: string;
  description: string;
}> = [
  {
    key: "needs_attention",
    title: "Needs Attention",
    description: "Company-wide exceptions that managers may need to act on.",
  },
  {
    key: "needs_my_attention",
    title: "Needs My Attention",
    description: "Company defaults for items related to the employee viewing the dashboard.",
  },
];

const severityOptions: Array<{
  value: DashboardRuleSeverity;
  label: string;
}> = [
  { value: "critical", label: "Critical" },
  { value: "important", label: "Important" },
  { value: "informational", label: "Informational" },
];

export default function CompanyDashboardRulesForm({
  initialSettings,
}: {
  initialSettings: DashboardRuleSetting[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateRule(
    ruleKey: string,
    patch: Partial<DashboardRuleSetting>,
  ) {
    setSettings((current) =>
      current.map((setting) =>
        setting.ruleKey === ruleKey ? { ...setting, ...patch } : setting,
      ),
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await updateCompanyDashboardRulesAction(settings);
      setSettings(updated);
      setMessage("Company Dashboard rules saved.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save Company Dashboard rules.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-8 space-y-6">
      {groups.map((group) => (
        <section
          key={group.key}
          className="rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{group.description}</p>
          </div>

          <div className="divide-y divide-gray-100">
            {DASHBOARD_RULES.filter((rule) => rule.group === group.key).map(
              (definition) => {
                const setting = settings.find(
                  (item) => item.ruleKey === definition.key,
                );
                if (!setting) return null;
                const threshold = getDashboardRuleThreshold(definition);

                return (
                  <div
                    key={definition.key}
                    className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_160px]"
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={setting.enabled}
                        onChange={(event) =>
                          updateRule(definition.key, {
                            enabled: event.target.checked,
                          })
                        }
                        className="mt-1 size-4 rounded border-gray-300"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">
                          {definition.label}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-gray-500">
                          {definition.description}
                        </span>
                        {threshold ? (
                          <span className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                            <span>{threshold.label}</span>
                            <input
                              type="number"
                              min={threshold.minimum}
                              max={threshold.maximum}
                              value={
                                setting.configuration[
                                  threshold.key
                                ] ?? threshold.defaultValue
                              }
                              disabled={!setting.enabled}
                              onChange={(event) =>
                                updateRule(definition.key, {
                                  configuration: {
                                    ...setting.configuration,
                                    [threshold.key]: Number(
                                      event.target.value,
                                    ),
                                  },
                                })
                              }
                              className="h-9 w-20 rounded-md border border-gray-300 px-2 disabled:bg-gray-100"
                            />
                          </span>
                        ) : null}
                      </span>
                    </label>

                    <label className="text-sm font-medium text-gray-700">
                      Severity
                      <select
                        value={setting.severity}
                        disabled={!setting.enabled}
                        onChange={(event) =>
                          updateRule(definition.key, {
                            severity: event.target
                              .value as DashboardRuleSeverity,
                          })
                        }
                        className="mt-1.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm disabled:bg-gray-100"
                      >
                        {severityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              },
            )}
          </div>
        </section>
      ))}

      {message ? (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save dashboard rules"}
        </Button>
      </div>
    </form>
  );
}
