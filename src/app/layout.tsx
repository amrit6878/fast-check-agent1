import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FactCheck Agent — AI-Powered Document Verification",
  description:
    "Upload reports, whitepapers, and PDFs to automatically verify claims against live web data using Google Gemini AI. Detect fake stats, outdated figures, and fabricated assertions instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
