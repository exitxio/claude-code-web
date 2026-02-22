import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/session-provider";

export const metadata: Metadata = {
  title: "Claude Code Web",
  description: "Self-hosted Claude Code web interface",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
