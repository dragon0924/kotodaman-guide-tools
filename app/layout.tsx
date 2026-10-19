import type { Metadata } from "next";
import { GuideLayout } from "@/components/GuideLayout";
import "./globals.css";

// Read the public projection on each request, including after publication is revoked.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "コトダマン攻略支援",
  description: "キャラ検索、特性検索、編成支援、クエスト攻略支援をまとめた攻略サイト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body><GuideLayout>{children}</GuideLayout></body>
    </html>
  );
}
