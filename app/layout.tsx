import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "모스트애드 마케팅 플랫폼",
  description: "마케팅 분석, 콘텐츠 제작, 주문 및 성과 관리를 한곳에서 관리하세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
