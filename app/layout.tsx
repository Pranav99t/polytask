import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageSelector } from "@/components/shared/LanguageSelector";
import { I18nProvider } from "@/components/providers/I18nProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PolyTask",
  description: "Multilingual collaborative task management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <I18nProvider>
          <div className="min-h-screen flex flex-col">
            <header className="border-b h-14 flex items-center px-4 justify-between">
              <h1 className="font-bold text-xl">PolyTask</h1>
              <LanguageSelector />
            </header>
            <main className="flex-1">
              {children}
            </main>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
