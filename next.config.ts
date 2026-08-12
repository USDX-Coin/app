import type { NextConfig } from "next";

// Security headers untuk semua respons (WSTG-CLNT-09 · USDX-380).
// netlify.toml [[headers]] HANYA berlaku untuk aset statis di CDN, TIDAK untuk respons
// SSR/dynamic Next.js — jadi header anti-clickjacking tak terpasang di runtime app.
// Dipasang di sini agar Next.js mengirim header di semua respons (SSR + statis).
// Nilai selaras dengan netlify.toml (USDX-362 / PR #32). frame-ancestors hanya mencegah
// app di-iframe pihak lain; TIDAK memengaruhi koneksi outbound wallet/RPC (wagmi/rainbowkit).
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
