import type { Metadata } from "next";
import { Providers } from "@/providers/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "USDX - USD Stablecoin",
  description: "Mint and redeem USDX stablecoin",
  icons: {
    // SVG dulu untuk browser modern (tajam di semua ukuran, 2,3 kB), PNG
    // sebagai cadangan untuk yang belum mendukung favicon SVG.
    icon: [
      { url: "/image/usdx-coin.svg", type: "image/svg+xml" },
      { url: "/image/usdx-logo.png", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
