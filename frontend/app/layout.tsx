import type { Metadata } from "next";
import { Share_Tech_Mono, Rajdhani, Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";

const shareTechMono = Share_Tech_Mono({
  weight: '400',
  variable: "--font-mono",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  weight: ['400', '500', '600', '700'],
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  weight: ["400", "500", "600"],
  variable: "--font-ui",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediTwin // Pharma_Sim",
  description: "Simulate how medications interact with your unique physiology using hybrid ML + AI analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${shareTechMono.variable} ${rajdhani.variable} ${fraunces.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] font-[var(--font-sans)]">
        {children}
      </body>
    </html>
  );
}
