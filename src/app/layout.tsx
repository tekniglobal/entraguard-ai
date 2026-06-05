import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "EntraGuard AI",
  description: "Agentic Identity Threat Investigator for Microsoft Entra ID",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        {children}
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  );
}
