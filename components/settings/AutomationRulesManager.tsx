"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import AutomationRuleDialog, { AUTOMATION_EVENTS } from "@/components/settings/AutomationRuleDialog";
import { Button } from "@/components/ui/button";
import {
  createAutomationRule,
  deleteAutomationRule,
  orderAutomationRules,
  setAutomationRuleEnabled,
  updateAutomationRule,
  type AutomationEmployee,
  type AutomationRule,
  type AutomationRuleValues,
} from "@/lib/services/task-automation";
import type { PipelineStageView } from "@/components/pipeline/constants";

type AutomationRulesManagerProps = {
  initialRules: AutomationRule[];
  employees: AutomationEmployee[];
  stages: PipelineStageView[];
  emailTemplates: { id: string; name: string }[];
};

export default function AutomationRulesManager({
  initialRules,
  employees,
  stages,
  emailTemplates,
}: AutomationRulesManagerProps) {
  const [rules, setRules] = useState(initialRules);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const ruleGroups = useMemo(() => {
    const keys = [...new Set(rules.map((rule) => `${rule.trigger_event}:${rule.trigger_value ?? ""}`))];
    return keys.map((key) => {
      const [event, value] = key.split(":");
      return { key, label: formatTrigger(event, value), rules: rules
        .filter((rule) => `${rule.trigger_event}:${rule.trigger_value ?? ""}` === key)
        .sort((a, b) => a.sort_order - b.sort_order) };
    });
  }, [rules]);

  function openNewRule() {
    setEditingRule(null);
    setDialogOpen(true);
  }

  function openEditRule(rule: AutomationRule) {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  async function saveRule(values: AutomationRuleValues) {
    const savedRule = editingRule
      ? await updateAutomationRule(editingRule.id, values)
      : await createAutomationRule(values);

    setRules((currentRules) =>
      editingRule
        ? currentRules.map((rule) => (rule.id === savedRule.id ? savedRule : rule))
        : [...currentRules, savedRule],
    );
  }

  async function toggleRule(rule: AutomationRule) {
    setBusyRuleId(rule.id);
    setErrorMessage("");

    try {
      await setAutomationRuleEnabled(rule.id, !rule.active);
      setRules((currentRules) =>
        currentRules.map((item) =>
          item.id === rule.id ? { ...item, active: !item.active } : item,
        ),
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyRuleId(null);
    }
  }

  async function removeRule(rule: AutomationRule) {
    if (!window.confirm(`Delete the automation rule "${rule.name}"?`)) return;

    setBusyRuleId(rule.id);
    setErrorMessage("");

    try {
      await deleteAutomationRule(rule.id);
      setRules((currentRules) => currentRules.filter((item) => item.id !== rule.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyRuleId(null);
    }
  }

  async function moveRule(rule: AutomationRule, direction: -1 | 1) {
    const group = rules
      .filter((item) => item.trigger_event === rule.trigger_event && item.trigger_value === rule.trigger_value)
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = group.findIndex((item) => item.id === rule.id);
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= group.length) return;

    const reordered = [...group];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const sortOrders = new Map(reordered.map((item, sortOrder) => [item.id, sortOrder]));
    const previousRules = rules;

    setRules((currentRules) =>
      currentRules.map((item) =>
        sortOrders.has(item.id)
          ? { ...item, sort_order: sortOrders.get(item.id) ?? item.sort_order }
          : item,
      ),
    );
    setBusyRuleId(rule.id);
    setErrorMessage("");

    try {
      await orderAutomationRules(reordered.map((item) => item.id));
    } catch (error) {
      setRules(previousRules);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyRuleId(null);
    }
  }

  return (
    <>
      <section className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Automation Rules</h2>
            <p className="mt-1 text-sm text-gray-500">
              Connect events across jobs, customers, appointments, tasks, and the pipeline.
            </p>
          </div>
          <Button type="button" size="lg" onClick={openNewRule}>
            <Plus /> New Rule
          </Button>
        </div>

        {errorMessage ? (
          <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {ruleGroups.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-gray-900">No automation rules yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Add a rule to connect CRM activity to tasks or pipeline updates.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {ruleGroups.map((group) => (
              <div key={group.key} className="p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {group.label}
                </h3>
                <div className="mt-3 space-y-3">
                  {group.rules.map((rule, index) => (
                    <article
                      key={rule.id}
                      className={`rounded-lg border p-4 ${
                        rule.active ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-70"
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-gray-900">{rule.name}</h4>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              rule.active ? "bg-green-50 text-green-700" : "bg-gray-200 text-gray-600"
                            }`}>
                              {rule.active ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-700">{formatAction(rule)}</p>
                          <p className="mt-1 text-sm text-gray-500">
                            {rule.action_type === "create_task"
                              ? `${formatDueTiming(rule.due_offset_days)} · ${formatAssignment(rule)}`
                              : "Runs immediately for the related job"}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={index === 0 || busyRuleId !== null}
                            onClick={() => moveRule(rule, -1)}
                            aria-label="Move rule up"
                          >
                            <ChevronUp />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={index === group.rules.length - 1 || busyRuleId !== null}
                            onClick={() => moveRule(rule, 1)}
                            aria-label="Move rule down"
                          >
                            <ChevronDown />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busyRuleId !== null}
                            onClick={() => toggleRule(rule)}
                          >
                            {rule.active ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busyRuleId !== null}
                            onClick={() => openEditRule(rule)}
                          >
                            <Pencil /> Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={busyRuleId !== null}
                            onClick={() => removeRule(rule)}
                          >
                            <Trash2 /> Delete
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {dialogOpen ? (
        <AutomationRuleDialog
          key={editingRule?.id ?? "new-rule"}
          open
          rule={editingRule}
          employees={employees}
          stages={stages}
          emailTemplates={emailTemplates}
          onOpenChange={setDialogOpen}
          onSave={saveRule}
        />
      ) : null}
    </>
  );
}

function formatDueTiming(days: number) {
  if (days === 0) return "Due immediately";
  return `Due ${days} day${days === 1 ? "" : "s"} later`;
}

function formatAssignment(rule: AutomationRule) {
  if (rule.action_type !== "create_task") return "Pipeline update";
  if (rule.assignment_type === "job_salesperson") return "Assign to job salesperson";
  const relation = Array.isArray(rule.employees) ? rule.employees[0] : rule.employees;
  return `Assign to ${relation?.name ?? "selected employee"}`;
}

function formatTrigger(event: string, value: string) {
  const label = AUTOMATION_EVENTS.find((item) => item.value === event)?.label ?? event;
  return value ? `${label}: ${value.split("_").join(" ")}` : label;
}

function formatAction(rule: AutomationRule) {
  if (rule.action_type === "update_job_status") return `Move related job to: ${rule.target_status}`;
  if (rule.action_type === "send_email") {
    const template = Array.isArray(rule.email_templates) ? rule.email_templates[0] : rule.email_templates;
    return `Send customer email: ${template?.name ?? "selected template"}`;
  }
  return `Create task: ${rule.task_title}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
