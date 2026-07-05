import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "GlobePay - Global payroll in stable dollars",
  description: "Clients hand over their freelancer list; GlobePay prepares payroll; one signature pays everyone in USDC — receipts and tax ledger built automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}