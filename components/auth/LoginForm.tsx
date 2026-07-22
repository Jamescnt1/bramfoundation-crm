"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const recoveryCode = searchParams.get("code");
    if (recoveryCode) {
      router.replace(`/reset-password?code=${encodeURIComponent(recoveryCode)}`);
      return;
    }

    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") router.replace("/reset-password");
    });

    if (window.location.hash.includes("type=recovery")) {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) router.replace("/reset-password");
      });
    }

    return () => listener.subscription.unsubscribe();
  }, [router, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningIn(true);
    setErrorMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    const result = (await response.json()) as {
      error?: string;
      mustChangePassword?: boolean;
    };

    if (!response.ok) {
      setErrorMessage(result.error ?? "Unable to sign in.");
      setIsSigningIn(false);
      return;
    }

    router.replace(
      result.mustChangePassword
        ? "/change-password"
        : searchParams.get("next") || "/dashboard",
    );
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      {searchParams.get("reset") === "success" ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Your password was updated. Sign in with your new password.
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div>
        <label htmlFor="login" className="text-sm font-medium text-gray-700">Email or username</label>
        <input
          id="login"
          type="text"
          autoComplete="username"
          required
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
        />
      </div>

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-gray-700 underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
        />
      </div>

      <button
        type="submit"
        disabled={isSigningIn}
        className="w-full rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {isSigningIn ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
