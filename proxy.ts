import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  const userMetadata = claims?.user_metadata && typeof claims.user_metadata === "object"
    ? claims.user_metadata as Record<string, unknown>
    : null;
  const isLogin = request.nextUrl.pathname === "/login";
  const isChangePassword = request.nextUrl.pathname === "/change-password";
  const isForgotPassword = request.nextUrl.pathname === "/forgot-password";
  const isResetPassword = request.nextUrl.pathname === "/reset-password";
  const isAuthConfirm = request.nextUrl.pathname === "/auth/confirm";
  const isLoginApi = request.nextUrl.pathname === "/api/auth/login";
  const isCustomerEmailWebhook =
    request.nextUrl.pathname === "/api/customer-email/webhook";
  const isTwilioWebhook =
    request.nextUrl.pathname === "/api/twilio/inbound" ||
    request.nextUrl.pathname === "/api/twilio/status";
  const isCronEndpoint =
    request.nextUrl.pathname === "/api/cron/appointment-reminders";
  const isLegalPage =
    request.nextUrl.pathname === "/privacy" ||
    request.nextUrl.pathname === "/sms-terms" ||
    request.nextUrl.pathname === "/sms-opt-in";
  const isPublicRoute =
    isLogin ||
    isForgotPassword ||
    isResetPassword ||
    isAuthConfirm ||
    isLoginApi ||
    isCustomerEmailWebhook ||
    isTwilioWebhook ||
    isCronEndpoint ||
    isLegalPage;

  if (!userId && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (userId && !isLoginApi && !isCustomerEmailWebhook && !isTwilioWebhook && !isCronEndpoint && !isLegalPage) {
    const { data: employee } = await supabase
      .from("employees")
      .select("active")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!employee?.active) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (
    userMetadata?.must_change_password === true &&
    !isChangePassword &&
    !isResetPassword
  ) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (userId && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
