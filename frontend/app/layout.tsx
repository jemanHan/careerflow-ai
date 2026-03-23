import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "CareerFlow AI",
  description: "AI-powered job application workflow MVP"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
