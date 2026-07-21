import AutomationRulesManager from "@/components/settings/AutomationRulesManager";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { requireEmployee } from "@/lib/services/employees";
import {
  getAutomationEmployees,
  getAutomationRules,
} from "@/lib/services/task-automation";
import { getPipelineStages } from "@/lib/services/pipeline-stages";
import { getEmailTemplates } from "@/lib/services/email-templates";

export const dynamic = "force-dynamic";

export default async function AutomationRulesSettingsPage() {
  await requireEmployee();
  const { rules, employees, stages, emailTemplates, errorMessage } = await loadAutomationSettings();

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <SettingsPageHeader
          title="Automation Rules"
          description="Connect activity across customers, jobs, appointments, tasks, and the pipeline."
        />

        {errorMessage ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            Unable to load automation settings: {errorMessage}
          </div>
        ) : (
          <AutomationRulesManager initialRules={rules} employees={employees} stages={stages} emailTemplates={emailTemplates.map(({ id, name }) => ({ id, name }))} />
        )}
      </div>
    </main>
  );
}

async function loadAutomationSettings() {
  try {
    const [rules, employees, stages, emailTemplates] = await Promise.all([
      getAutomationRules(),
      getAutomationEmployees(),
      getPipelineStages(),
      getEmailTemplates(),
    ]);

    return { rules, employees, stages, emailTemplates, errorMessage: "" };
  } catch (error) {
    return {
      rules: [],
      employees: [],
      stages: [],
      emailTemplates: [],
      errorMessage:
        error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }
}
