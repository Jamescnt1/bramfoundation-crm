import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Terms | Foundation CRM",
  description: "Terms and conditions for the Foundation CRM beta messaging program.",
};

export default function SmsTermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-12 sm:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-blue-700">Foundation CRM</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">SMS Terms and Conditions</h1>
        <p className="mt-2 text-sm text-gray-500">Effective August 8, 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-gray-700 sm:text-base">
          <TermsSection title="Program description">
            <p>The Foundation CRM beta messaging program sends operational and customer-care text messages to people who have explicitly opted in. Messages may include beta connection tests, appointment reminders or changes, schedule confirmations, job-status updates, installer or employee work notifications, and replies related to service activity.</p>
          </TermsSection>

          <TermsSection title="Consent">
            <p>You may opt in by texting START to <a className="font-medium text-blue-700 hover:underline" href="sms:+16232330122">(623) 233-0122</a> or through another clearly disclosed consent process maintained by the program administrator. Consent to receive text messages is not a condition of purchasing goods or services.</p>
          </TermsSection>

          <TermsSection title="Frequency and charges">
            <p>Message frequency varies based on beta testing, appointments, schedules, job activity, and conversations you participate in. Message and data rates may apply according to your mobile carrier and plan.</p>
          </TermsSection>

          <TermsSection title="Opting out">
            <p>Reply STOP at any time to stop SMS messages. You may receive a final confirmation that your opt-out was processed. After opting out, no further SMS messages will be sent unless you provide consent again by replying START or completing another disclosed opt-in process.</p>
          </TermsSection>

          <TermsSection title="Help">
            <p>Reply HELP for assistance or call or text <a className="font-medium text-blue-700 hover:underline" href="tel:+16232330122">(623) 233-0122</a>. Mobile carriers are not liable for delayed or undelivered messages.</p>
          </TermsSection>

          <TermsSection title="Privacy">
            <p>We handle personal and mobile information as described in the <Link href="/privacy" className="font-medium text-blue-700 hover:underline">Foundation CRM Privacy Policy</Link>. Mobile opt-in information is not sold or shared with third parties or affiliates for marketing or promotional purposes.</p>
          </TermsSection>

          <TermsSection title="Changes">
            <p>These terms may be updated to reflect changes to the beta program, legal requirements, or messaging practices. The effective date above identifies the current version.</p>
          </TermsSection>
        </div>

        <footer className="mt-10 border-t border-gray-200 pt-5 text-sm text-gray-500">
          <Link href="/privacy" className="font-medium text-blue-700 hover:underline">Privacy Policy</Link>
        </footer>
      </article>
    </main>
  );
}

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="text-lg font-semibold text-gray-900">{title}</h2><div className="mt-2">{children}</div></section>;
}
