import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ลงเวลา ศกศ.6 - ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จ.ลพบุรี",
  description: "ระบบลงเวลาเข้า-ออกงาน ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ลงเวลา ศกศ.6",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body
        className={`${notoSansThai.variable} font-sans antialiased bg-slate-50 text-slate-800`}
      >
        {children}
      </body>
    </html>
  );
}
