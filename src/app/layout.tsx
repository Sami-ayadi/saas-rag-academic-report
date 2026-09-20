import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/session-provider";

const notoSans = localFont({
  src: [
    { path: "./fonts/noto-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/noto-sans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RAG Report - Plateforme de Génération de Rapports Académiques",
  description:
    "Cadrez, rédigez et vérifiez un brouillon académique structuré à partir de vos propres sources.",
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
    icon: "/logo.svg",
  },
  openGraph: {
    title: "RAG Report - Plateforme de Génération de Rapports Académiques",
    description:
      "Cadrez, rédigez et vérifiez un brouillon académique structuré à partir de vos propres sources.",
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
        className={`${notoSans.variable} antialiased bg-background text-foreground`}
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
