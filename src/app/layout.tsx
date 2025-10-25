import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ThemeProvider } from "@/providers";
import { ArchiveProvider } from "@/lib/archive/provider";
import "@/lib/immer-config";
import { Toaster } from "@/components/ui";
import { OAuthClientProvider } from "@/components/providers/OAuthClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Research Navigator",
  description: "智能研究助手 - 发现、管理和分析学术文献",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Always prefer same-origin proxy to avoid mixed content; fallback env allows local dev.
  const authServiceUrl = '/api/auth';
  const oauthClientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID as string | undefined;
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased ui-compact`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          {oauthClientId ? (
            <OAuthClientProvider authServiceUrl={authServiceUrl} clientId={oauthClientId}>
              <ArchiveProvider>
                {children}
                {/* Global toast portal */}
                <Toaster richColors expand />
              </ArchiveProvider>
            </OAuthClientProvider>
          ) : (
            <ArchiveProvider>
              {children}
              {/* Global toast portal */}
              <Toaster richColors expand />
            </ArchiveProvider>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
