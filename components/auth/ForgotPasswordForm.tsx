"use client";

import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsSending(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        If an account exists for that email, a secure password-reset link has been sent.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      <div>
        <label htmlFor="reset-email" className="text-sm font-medium text-gray-700">Email address</label>
        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
        />
      </div>
      <button type="submit" disabled={isSending} className="w-full rounded-lg bg-black px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-60">
        {isSending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
