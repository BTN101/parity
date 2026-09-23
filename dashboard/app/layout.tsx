import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parity — behavioural equivalence for AI-modernised COBOL",
  description:
    "Runs legacy COBOL and its AI translation side by side, finds every input where they disagree, and turns each difference into a recorded decision.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
