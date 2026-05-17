import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuruWatch - YouTube finance receipts",
  description:
    "Paste a YouTube finance channel. We pull every ticker call from the last 30 days and score it against price. Free, no login.",
  openGraph: {
    title: "GuruWatch - YouTube finance receipts",
    description:
      "Track every ticker call a YouTube finance creator has made, with hit/miss flags from real prices. The receipts.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GuruWatch - YouTube finance receipts",
    description:
      "Score any YouTube finance creator on their ticker calls. Free, public data.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-black text-gray-100 antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
