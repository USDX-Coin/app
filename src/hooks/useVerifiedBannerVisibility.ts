"use client";

import { useEffect, useState } from "react";

// Transient VERIFIED banner on /mint (USDX-175). The KYC success banner is a
// one-time confirmation, not a permanent status: it shows once per user for
// TTL ms after first render, then auto-hides and never returns on later visits.
export const KYC_VERIFIED_BANNER_TTL_MS = 5000;

// localStorage flag keyed per user id — "this user has already seen the banner".
const SEEN_KEY_PREFIX = "usdx:kyc-verified-banner-seen:";

// Test seam (mirrors the usdx-mock-* seams): shorten the TTL via localStorage so
// Playwright doesn't wait the full 5s. Returns the default outside the browser or
// when unset/invalid.
function resolveTtlMs(): number {
  if (typeof localStorage === "undefined") return KYC_VERIFIED_BANNER_TTL_MS;
  const raw = localStorage.getItem("usdx-mock-banner-ttl");
  if (raw === null) return KYC_VERIFIED_BANNER_TTL_MS;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : KYC_VERIFIED_BANNER_TTL_MS;
}

export function verifiedBannerSeenKey(userId: string): string {
  return SEEN_KEY_PREFIX + userId;
}

// Returns whether the transient VERIFIED banner should currently render.
// `enabled` gates the logic to the VERIFIED state so the hook stays unconditional
// at the call site; `userId` keys the per-user "seen" flag.
//
// The flag is set on the FIRST render (not when the timer fires) — navigating
// away before the TTL still counts as seen. State starts hidden and flips on in
// an effect to avoid reading localStorage during SSR/render (no hydration
// mismatch). The timer is cleared on unmount, so there is no setState after
// unmount.
export function useVerifiedBannerVisibility(
  enabled: boolean,
  userId: string | null | undefined,
): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !userId || typeof localStorage === "undefined") return;

    const key = verifiedBannerSeenKey(userId);
    if (localStorage.getItem(key)) return; // seen on a previous visit → stay hidden

    localStorage.setItem(key, "1");
    // Post-mount reveal after the localStorage check — intentional, mirrors the
    // SSR-safe pattern in LanguageProvider.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), resolveTtlMs());
    return () => clearTimeout(timer);
  }, [enabled, userId]);

  return visible;
}
