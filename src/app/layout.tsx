import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LedgerPulse — Real-Time COGS & Financial Analytics",
  description: "Multi-Tenant Financial Analytics & Real-Time COGS Engine for Shopify & Etsy"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
