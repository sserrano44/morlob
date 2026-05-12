import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Morlob",
  description: "Control plane and backend for external agents"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
