import type { Metadata } from "next";
import { Spectral, Overpass_Mono } from "next/font/google";
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
        {children}
      </body>
    </html>
  );
}
