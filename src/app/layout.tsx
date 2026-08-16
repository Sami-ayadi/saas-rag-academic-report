import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAG Report - Plateforme de Génération de Rapports Académiques",
  description:
    "Générez des rapports académiques de qualité grâce à notre pipeline RAG intelligent. Importez vos documents, synthétisez les connaissances et produisez des rapports structurés.",
  keywords: [
    "RAG",
    "rapport académique",
    "intelligence artificielle",
    "génération de contenu",
    "recherche",
    "synthèse",
  ],
  authors: [{ name: "RAG Report Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "RAG Report - Plateforme de Génération de Rapports Académiques",
    description:
      "Générez des rapports académiques de qualité grâce à notre pipeline RAG intelligent.",
    siteName: "RAG Report",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await headers();

  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            {children}
            <Toaster position="bottom-right" richColors />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
