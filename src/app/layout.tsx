import type { Metadata } from "next";
import { Providers } from "@/providers/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "USDX - USD Stablecoin",
  description: "Mint and redeem USDX stablecoin",
  icons: {
    // File koin yang sama dengan landing (usdx.co.id) — satu sumber logo.
    icon: [{ url: "/image/logo-coin.png", type: "image/png" }],
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
