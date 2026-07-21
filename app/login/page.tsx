import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-gray-500">Foundation Flooring</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Sign in</h1>
        <p className="mt-2 text-gray-600">Open your Foundation CRM workspace.</p>
        <Suspense fallback={<p className="mt-8 text-sm text-gray-500">Loading sign-in…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
