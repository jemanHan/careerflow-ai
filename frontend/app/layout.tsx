import "./globals.css";
import { ReactNode } from "react";
import { GlobalAppNav } from "../components/global-app-nav";

export const metadata = {
  title: "CareerFlow AI",
  description: "AI-powered job application workflow MVP"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50">
        <GlobalAppNav />
        <div className="mx-auto w-full max-w-7xl px-4 py-4">{children}</div>
      </body>
    </html>
  );
}
