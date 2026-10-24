import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hukamnama Studio — Sikhizm.com",
  description:
    "Create branded Daily Hukamnama visuals for Sikhizm.com: Sri Harmandir Sahib background, ChatrikUni Gurmukhi typography, and one-click exports for WhatsApp, Instagram Reels, YouTube Shorts and Facebook.",
};

export const viewport: Viewport = {
  themeColor: "#0a0b10",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/ChatrikUni.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body className="bg-[#0a0b10] text-zinc-200 antialiased">{children}</body>
    </html>
  );
}
