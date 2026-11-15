import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zero-Trust LLM Gateway",
  description:
    "Enterprise Security Operations Center (SOC) dashboard for inspecting, sanitizing, and governing LLM traffic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#05080f] text-slate-100 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        <div className="fixed inset-0 pointer-events-none bg-cyber-grid bg-[size:32px_32px] opacity-60" />
        <div className="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="fixed -bottom-40 -right-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
        <div className="relative z-10 flex h-screen w-screen overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
