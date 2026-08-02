import {
  getPipelineStage,
  getStageStyles,
  PIPELINE_STAGE_STYLES,
  resolveConfiguredStage,
  type PipelineStageView,
} from "@/components/pipeline/constants";

type PipelineStatusBadgeProps = {
  status: string | null;
  className?: string;
  stages?: PipelineStageView[];
};

export default function PipelineStatusBadge({
  status,
  className = "",
  stages,
}: PipelineStatusBadgeProps) {
  if (stages?.length) {
    const configuredStage = resolveConfiguredStage(status, stages);
    if (configuredStage) {
      const configuredStyles = getStageStyles(configuredStage);
      return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${configuredStyles.badge} ${className}`}><span className={`h-2 w-2 shrink-0 rounded-full ${configuredStyles.accent}`} aria-hidden="true" />{configuredStage.label}</span>;
    }
  }
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
