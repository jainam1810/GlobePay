import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: "GlobePay - Global payroll in stable dollars",
  description: "Pay worldwide contractors in USDC. AI reads invoices, records stay audit-ready.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}