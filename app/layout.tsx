import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import "lxgw-wenkai-webfont/style.css";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Better Me · 你的健康手账",
  description: "一步一步，算出属于你的 BMI、热量与目标计划",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${caveat.variable} antialiased`}>{children}</body>
    </html>
  );
}
