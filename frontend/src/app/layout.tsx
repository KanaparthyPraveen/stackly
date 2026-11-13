import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { AuthProvider } from "../context/auth-context";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Stackly — Identity for Developers",
    template: "%s · Stackly",
  },
  description:
    "Your developer identity, in one place. Showcase projects, links, GitHub, and social connections.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-background text-foreground font-sans selection:bg-[#7C3AED]/30 selection:text-white">
        {/* Midnight purple atmospheric lighting */}
        <div
          aria-hidden
          className="bg-midnight-glow pointer-events-none fixed inset-x-0 top-0 -z-10 h-full"
        />
        <div
          aria-hidden
          className="bg-violet-atmosphere pointer-events-none fixed inset-x-0 top-0 -z-10 h-full"
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

export const viewport: Viewport = {
  themeColor: "#09070D",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};
