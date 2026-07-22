import Link from "next/link";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-gray-500">Foundation Flooring</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Reset your password</h1>
        <p className="mt-2 text-gray-600">We’ll email you a secure link to choose a new password.</p>
        <ForgotPasswordForm />
        <Link href="/login" className="mt-6 block text-center text-sm font-medium text-gray-700 underline-offset-4 hover:underline">Return to sign in</Link>
      </section>
    </main>
  );
}
