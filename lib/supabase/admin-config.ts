export class SupabaseAdminConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseAdminConfigurationError";
  }
}

export function getSupabaseAdminConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    environment.SUPABASE_SECRET_KEY ?? environment.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new SupabaseAdminConfigurationError(
      "Employee administration requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  return { url, secretKey };
}
