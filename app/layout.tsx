import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Markly — Smart Bookmarks",
  description: "A beautiful bookmark manager powered by Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
