import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageSelector } from "@/components/shared/LanguageSelector";
import { UserMenu } from "@/components/shared/UserMenu";
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
          <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100">
            <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md h-16 flex items-center px-6 justify-between shadow-sm">
              <a href="/dashboard" className="flex items-center gap-2 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-violet-200 group-hover:shadow-violet-300 transition-shadow">
                  P
                </div>
                <span className="font-bold text-xl bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  PolyTask
                </span>
              </a>
              <div className="flex items-center gap-4">
                <LanguageSelector />
                <UserMenu />
              </div>
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
