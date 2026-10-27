import {ActionFeedbackHost} from '../components/action-feedback';
import type { Metadata } from "next";
import {LOCAL_TEST} from '../lib/runtime';
import "./globals.css";
import "./production-plan.css";
import "./planning-compact.css";
import "./production-management.css";
import "./table-theme.css";
import "./ui-consistency.css";
import "./compact-workspace.css";
import "../components/onspa-ui/manual-pagination.css";

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
      <body className="antialiased">
        {LOCAL_TEST && <div style={{position:"fixed",bottom:8,right:8,zIndex:2147483647,background:"#842400",color:"white",padding:"6px 12px",borderRadius:4,fontSize:13,fontFamily:"sans-serif"}}>MÔI TRƯỜNG TEST · Dữ liệu local</div>}
        {children}
        <ActionFeedbackHost />
      </body>
    </html>
  );
}
