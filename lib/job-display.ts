export type JobDisplayValues = {
  customerName?: string | null;
  jobName?: string | null;
  qfNumber?: string | null;
};

/**
 * The single display convention for jobs outside the Customers hierarchy.
 * `jobs.customer_name` is the legacy database column that now stores the
 * project/job name; the linked customer's name comes from customers.full_name.
 */
export function formatJobDisplayName({
  customerName,
  jobName,
  qfNumber,
}: JobDisplayValues): string {
  const customer = customerName?.trim() || "Customer unavailable";
  const job = jobName?.trim() || "Untitled job";
  const qf = qfNumber?.trim();

  return [customer, job, qf ? `QF# ${qf}` : null]
    .filter(Boolean)
    .join(" - ");
}
