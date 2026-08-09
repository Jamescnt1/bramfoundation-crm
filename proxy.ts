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

  const { data: { user } } = await supabase.auth.getUser();
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
  const isLegalPage =
    request.nextUrl.pathname === "/privacy" ||
    request.nextUrl.pathname === "/sms-terms";
  const isPublicRoute =
    isLogin ||
    isForgotPassword ||
    isResetPassword ||
    isAuthConfirm ||
    isLoginApi ||
    isCustomerEmailWebhook ||
    isTwilioWebhook ||
    isLegalPage;

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && !isLoginApi && !isCustomerEmailWebhook && !isTwilioWebhook && !isLegalPage) {
    const { data: employee } = await supabase
      .from("employees")
      .select("active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!employee?.active) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (
    user?.user_metadata?.must_change_password === true &&
    !isChangePassword &&
    !isResetPassword
  ) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (user && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
