import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAdminConfiguration,
  SupabaseAdminConfigurationError,
} from "@/lib/supabase/admin-config";

export { SupabaseAdminConfigurationError };

export function createAdminClient() {
  const { url, secretKey } = getSupabaseAdminConfiguration();

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
