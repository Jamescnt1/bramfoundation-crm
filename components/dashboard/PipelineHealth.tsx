import Link from "next/link";
import { getStageStyles, type PipelineStageView } from "@/components/pipeline/constants";
import type { DashboardJob } from "@/lib/services/company-dashboard";
import { formatJobDisplayName } from "@/lib/job-display";

export default function PipelineHealth({ pipeline, stages }: { pipeline: Record<string, DashboardJob[]>; stages: PipelineStageView[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {stages.map((stage) => {
        const jobs = pipeline[stage.slug] ?? [];
        const styles = getStageStyles(stage);
        return (
          <div key={stage.slug} className={`overflow-hidden rounded-lg border ${styles.border}`}>
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} /><h3 className="text-sm font-semibold text-gray-900">{stage.label}</h3></div><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles.badge}`}>{jobs.length}</span></div>
            <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
              {jobs.length ? jobs.map((job) => <Link key={job.id} href={`/leads/${job.id}`} className="block px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50">{formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}</Link>) : <p className="px-3 py-4 text-xs text-gray-400">No jobs</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
