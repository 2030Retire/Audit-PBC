import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audit PBC",
  description: "PBC Document Management for Accounting Firms",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
