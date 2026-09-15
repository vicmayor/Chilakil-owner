import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Chilakil Owner",
    template: "%s · Chilakil Owner",
  },
  description:
    "Mobile owner app for Chilakil To Go — Glendale restaurant and Avondale food trailer, tracked separately.",
  applicationName: "Chilakil Owner",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Chilakil",
  },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full bg-brand font-sans text-ink">{children}</body>
    </html>
  );
}
