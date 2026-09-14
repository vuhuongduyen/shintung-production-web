import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ONSPA SKU Master Preview",
  description: "Bản xem trước giao diện danh sách và hồ sơ chi tiết SKU Master.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
