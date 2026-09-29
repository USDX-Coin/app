import type { NextConfig } from "next";

// Security headers untuk semua respons (WSTG-CLNT-09 · USDX-380, nilai dari USDX-362).
// Dipasang di sini, BUKAN di config reverse proxy, supaya Next.js sendiri yang mengirim
// header di semua respons (SSR + statis) — ikut ke mana pun app ini di-host.
// frame-ancestors hanya mencegah app di-iframe pihak lain; TIDAK memengaruhi koneksi
// outbound wallet/RPC (wagmi/rainbowkit).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
