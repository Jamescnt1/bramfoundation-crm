import ChangePasswordForm from "@/components/auth/ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-gray-500">Foundation Flooring</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Create a new password</h1>
        <p className="mt-2 text-gray-600">Your temporary password must be replaced before you continue.</p>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
