import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getCompanySettings } from "@/lib/services/company-settings";
import { getCurrentEmployee } from "@/lib/services/employees";

export const metadata: Metadata = {
  title: "Foundation CRM",
  description: "Flooring sales pipeline management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const employee = await getCurrentEmployee();
  const companyName = employee
    ? (await getCompanySettings()).company_name
    : null;

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <div className="foundation-app">
          <AppShell employee={employee} companyName={companyName}>
            {children}
          </AppShell>
        </div>
      </body>
    </html>
  );
}
