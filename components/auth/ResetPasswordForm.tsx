"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || session)) setIsReady(true);
    });

    async function prepareRecoverySession() {
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && active) setErrorMessage("This reset link is invalid or has expired. Request a new one.");
        else if (active) setIsReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (active && data.session) setIsReady(true);
      else if (active && !window.location.hash.includes("type=recovery")) {
        setErrorMessage("This reset link is invalid or has expired. Request a new one.");
      }
    }

    void prepareRecoverySession();
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password !== confirmation) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setErrorMessage("Use at least 10 characters with uppercase, lowercase, a number, and a symbol.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({
      password,
      data: { ...user?.user_metadata, must_change_password: false },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?reset=success");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      {errorMessage ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div> : null}
      <div>
        <label htmlFor="recovery-password" className="text-sm font-medium text-gray-700">New password</label>
        <input id="recovery-password" type="password" autoComplete="new-password" required disabled={!isReady} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 disabled:bg-gray-100" />
      </div>
      <div>
        <label htmlFor="recovery-confirmation" className="text-sm font-medium text-gray-700">Confirm new password</label>
        <input id="recovery-confirmation" type="password" autoComplete="new-password" required disabled={!isReady} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 disabled:bg-gray-100" />
      </div>
      <button type="submit" disabled={!isReady || isSaving} className="w-full rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-60">
        {isSaving ? "Updating…" : isReady ? "Update password" : "Verifying reset link…"}
      </button>
    </form>
  );
}
