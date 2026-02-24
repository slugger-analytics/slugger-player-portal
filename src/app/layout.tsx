// PURPOSE: Root layout for Available Player Portal (App Router).
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Available Player Portal",
  description: "Real-time recruitment command center for Atlantic League baseball teams.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
