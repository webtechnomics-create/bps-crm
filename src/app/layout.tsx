import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BPS Admissions CRM",
  description: "Admission lead management for Birla Public School, Kishangarh",
};
export const viewport: Viewport = { themeColor: "#1d43a0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
