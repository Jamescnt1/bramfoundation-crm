import { CheckCircle2 } from "lucide-react";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";

type SettingsPlaceholderProps = {
  title: string;
  description: string;
  plannedFeatures: string[];
};

export default function SettingsPlaceholder({
  title,
  description,
  plannedFeatures,
}: SettingsPlaceholderProps) {
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <SettingsPageHeader title={title} description={description} />

        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Management page prepared</h2>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              Planned
            </span>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            This dedicated route is ready for future configuration tools. Adding the
            feature here will not require reorganizing the Settings hub later.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {plannedFeatures.map((feature) => (
              <div
                key={feature}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
