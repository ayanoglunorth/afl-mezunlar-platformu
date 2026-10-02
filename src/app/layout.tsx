import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthListener } from "@/components/auth/AuthListener";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { MessageToast } from "@/components/realtime/MessageToast";
import { AboutUs } from "@/components/home/AboutUs";

const dmSans = localFont({
  src: [
    {
      path: "./fonts/DMSans-Variable.ttf",
      weight: "100 1000",
      style: "normal",
    },
    {
      path: "./fonts/DMSans-Italic-Variable.ttf",
      weight: "100 1000",
      style: "italic",
    },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aflmezunlar.org"),
  title: "AFL Mezun Platformu — Mentorluk & Networking",
  description: "Lise öğrencileri ve mezunlarını buluşturan mentorluk ve networking platformu. Üniversite, Erasmus ve kariyer rehberliği.",
  openGraph: {
    title: "AFL Mezun Platformu",
    description: "Lise öğrencileri ve mezunlarını buluşturan mentorluk ve networking platformu.",
    url: "https://aflmezunlar.org", // Kendi domaininiz ile değiştirin
    siteName: "AFL Mezun Platformu",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AFL Mezun Platformu",
    description: "Lise öğrencileri ve mezunlarını buluşturan mentorluk ve networking platformu.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${dmSans.variable} flex min-h-[100dvh] flex-col antialiased`}>
        <RealtimeProvider>
          <AuthListener />
          <MessageToast />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-surface-200/60 bg-gradient-to-b from-white/20 to-surface-50/80 backdrop-blur-sm">
            <AboutUs />
          </footer>
        </RealtimeProvider>
      </body>
    </html>
  );
}
