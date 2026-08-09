import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Foundation CRM",
  description: "Privacy policy for Foundation CRM and its beta messaging program.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-12 sm:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-blue-700">Foundation CRM</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Effective August 8, 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-gray-700 sm:text-base">
          <PolicySection title="Information we collect">
            <p>Foundation CRM may process contact details, including names, email addresses, mobile numbers, communication preferences, consent records, appointment information, job-related information, and messages exchanged through the service.</p>
          </PolicySection>

          <PolicySection title="How we use information">
            <p>We use this information to operate and test the CRM, provide requested services, manage appointments and job activity, deliver operational notifications, maintain communication history, honor communication preferences, prevent misuse, and improve reliability and security.</p>
          </PolicySection>

          <PolicySection title="Mobile information">
            <p><strong>Mobile information will not be sold, rented, or shared with third parties or affiliates for marketing or promotional purposes.</strong> We may share information with service providers that help deliver requested communications, such as telecommunications and hosting providers, only as necessary to operate the service. Text-message opt-in data and consent will not be shared with third parties for their own marketing.</p>
          </PolicySection>

          <PolicySection title="SMS communications">
            <p>People receive SMS messages only after providing consent. Messages may include beta tests, appointment reminders, schedule confirmations, job-status updates, and other operational communications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for assistance.</p>
          </PolicySection>

          <PolicySection title="Retention and security">
            <p>We retain information only as reasonably necessary for operations, communication records, compliance, dispute resolution, and security. We use administrative, technical, and organizational safeguards designed to protect information, but no system can guarantee absolute security.</p>
          </PolicySection>

          <PolicySection title="Your choices">
            <p>You may ask to review or correct your contact information through your Foundation CRM beta administrator. You may withdraw SMS consent at any time by replying STOP. Opting out of SMS does not prevent communications through other channels where permitted.</p>
          </PolicySection>

          <PolicySection title="Contact">
            <p>For messaging assistance, reply HELP or call or text <a className="font-medium text-blue-700 hover:underline" href="tel:+16232330122">(623) 233-0122</a>.</p>
          </PolicySection>
        </div>

        <footer className="mt-10 border-t border-gray-200 pt-5 text-sm text-gray-500">
          <Link href="/sms-terms" className="font-medium text-blue-700 hover:underline">SMS Terms and Conditions</Link>
        </footer>
      </article>
    </main>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="text-lg font-semibold text-gray-900">{title}</h2><div className="mt-2">{children}</div></section>;
}
