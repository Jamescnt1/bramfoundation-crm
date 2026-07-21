import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Browser requests use the signed-in user's cookie-backed session so RLS is
// enforced. Server Components run behind proxy.ts and use the service role for
// existing service functions that are shared with client components. Next.js
// never includes non-NEXT_PUBLIC environment values in browser bundles.
export const supabase = typeof window === "undefined"
  ? createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : createBrowserClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
