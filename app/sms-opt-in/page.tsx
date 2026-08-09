import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Beta Opt-In | Foundation CRM",
  description: "Public opt-in instructions for Foundation CRM beta text messages.",
};

export default function SmsOptInPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-12 sm:px-8">
      <article className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-blue-700">Virgil Whitehead — Foundation CRM beta</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Opt in to beta text messages</h1>
        <p className="mt-4 leading-7 text-gray-700">
          To participate, text <strong>START</strong> to{" "}
          <a className="font-semibold text-blue-700 hover:underline" href="sms:+16232330122?body=START">
            (623) 233-0122
          </a>.
        </p>

        <section className="mt-7 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
          <h2 className="font-semibold">SMS consent disclosure</h2>
          <p className="mt-2">
            By texting START, you expressly consent to receive recurring operational beta test SMS messages from Virgil Whitehead through Foundation CRM at the mobile number you use. Messages may include appointment reminders, schedule confirmations, job-status updates, installer or employee work notifications, and direct service-related conversations. Message frequency varies. Message and data rates may apply. Consent is not a condition of purchasing goods or services. Reply HELP for help or STOP to opt out at any time.
          </p>
        </section>

        <p className="mt-6 text-sm leading-6 text-gray-600">
          Participation is limited to informed Foundation CRM beta testers. Do not opt in if you have not agreed to participate in the beta test.
        </p>

        <footer className="mt-9 flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-200 pt-5 text-sm">
          <Link href="/privacy" className="font-medium text-blue-700 hover:underline">Privacy Policy</Link>
          <Link href="/sms-terms" className="font-medium text-blue-700 hover:underline">SMS Terms and Conditions</Link>
        </footer>
      </article>
    </main>
  );
}
