import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Lexend, M_PLUS_1_Code } from "next/font/google";
import "./globals.css";

// Passo Ritmo type system: Lexend for headlines, Instrument Sans for body, M PLUS 1 Code for
// paces, distances and countdowns.
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], display: "swap" });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], display: "swap" });
const mplusCode = M_PLUS_1_Code({ variable: "--font-mplus-code", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Corrida",
  description: "Coach virtual de corrida",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#090d14" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${lexend.variable} ${instrument.variable} ${mplusCode.variable}`}>
      <body>{children}</body>
    </html>
  );
}
