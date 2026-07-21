import {
  getPipelineStage,
  PIPELINE_STAGE_STYLES,
} from "@/components/pipeline/constants";

type PipelineStatusBadgeProps = {
  status: string | null;
  className?: string;
};

export default function PipelineStatusBadge({
  status,
  className = "",
}: PipelineStatusBadgeProps) {
  const stage = getPipelineStage(status);
  const styles = PIPELINE_STAGE_STYLES[stage];

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles.badge} ${className}`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${styles.accent}`}
        aria-hidden="true"
      />
      {stage}
    </span>
  );
}
