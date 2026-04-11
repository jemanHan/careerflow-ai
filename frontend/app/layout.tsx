import "./globals.css";
import { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import { GlobalAppNav } from "../components/global-app-nav";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata = {
  title: "CareerFlow AI",
  description: "AI-powered job application workflow MVP"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${manrope.variable} ${inter.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
      </head>
      <body className="min-h-screen bg-surface font-body text-on-surface">
        <GlobalAppNav />
        {children}
      </body>
    </html>
  );
}
