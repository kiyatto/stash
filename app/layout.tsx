import type { Metadata } from "next";
import { Spectral, Overpass_Mono } from "next/font/google";
import { AppHeader } from "@/components/layout/AppHeader";
import { HeaderLeftProvider } from "@/components/layout/HeaderLeftSlot";
import "./globals.css";

const spectral = Spectral({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const overpassMono = Overpass_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stash",
  description: "Collect and organize anything on an infinite canvas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spectral.variable} ${overpassMono.variable} h-full min-h-dvh antialiased`}
    >
      <body className="flex h-full min-h-dvh flex-col overflow-hidden">
        <HeaderLeftProvider>
          <AppHeader />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </HeaderLeftProvider>
      </body>
    </html>
  );
}
