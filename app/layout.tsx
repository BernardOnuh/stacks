import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StacksSwap",
  description: "StacksSwap",
  other: {
    "talentapp:project_verification": "a44aa4a29d043d2adf9653d0d5889ade60e9715728cca225e277c33c9d39b860b390fa333caf29b3d87676fc641da3827bdd9fdf51b325384bbecb60194c383e",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Script
          src="https://sdk.monnify.com/plugin/monnify.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}