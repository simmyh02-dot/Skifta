import type { Metadata } from "next";
import { Familjen_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { defaultLocale } from "@/i18n/config";

const display = Familjen_Grotesk({
  variable: "--font-familjen",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skifta — Driv veckan utan pappersarbetet",
  description:
    "Schema, stämpelklocka och löneklara timmar i en enkel app för små restauranger med 5–15 anställda. Till en bråkdel av priset mot de stora systemen.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang={defaultLocale}
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg font-sans text-ink">
        <LocaleProvider initialLocale={defaultLocale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
