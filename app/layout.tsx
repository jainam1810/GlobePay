import type { Metadata } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import "./globals.css";
import Providers from "@/components/providers";
import { config } from "@/lib/wagmi";

export const metadata: Metadata = {
  title: "GlobePay - Global payroll in stable dollars",
  description: "Clients hand over their freelancer list; GlobePay prepares payroll; one signature pays everyone in USDC — receipts and audit records built automatically.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The wallet state the browser already had, read from the cookie so the very
  // first render knows about it. Without this the server always renders
  // "not connected", and a returning user sees Connect Wallet blink past.
  const initialState = cookieToInitialState(config, (await headers()).get("cookie"));

  return (
    <html lang="en">
      <body>
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}