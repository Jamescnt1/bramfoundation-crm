export function productionPipelineErrorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : "";

  if (raw.includes("PRODUCTION_QF_NUMBER_REQUIRED")) {
    return "Enter the job QF# in Edit Job Info before beginning production. The production change was not saved.";
  }
  if (raw.includes("PRODUCTION_CONTRACT_AMOUNT_REQUIRED")) {
    return "Enter the Contract Amount in Edit Job Info before beginning production. The production change was not saved.";
  }

  return raw || fallback;
}
