import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { login?: string; password?: string }
    | null;
  const login = body?.login?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  if (!login || !password) {
    return Response.json({ error: "Login and password are required." }, { status: 400 });
  }

  let email = login;
  if (!login.includes("@")) {
    const admin = createAdminClient();
    const { data: employee, error } = await admin
      .from("employees")
      .select("email, active")
      .ilike("username", login)
      .maybeSingle();

    if (error || !employee?.email || !employee.active) {
      return Response.json({ error: "Invalid login or password." }, { status: 401 });
    }
    email = employee.email;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return Response.json({ error: "Invalid login or password." }, { status: 401 });
  }

  return Response.json({
    mustChangePassword: data.user.user_metadata?.must_change_password === true,
  });
}
