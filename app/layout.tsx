import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
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
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AppShell employee={await getCurrentEmployee()}>{children}</AppShell>
      </body>
    </html>
  );
}
