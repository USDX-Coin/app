import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useVerifiedBannerVisibility,
  verifiedBannerSeenKey,
  KYC_VERIFIED_BANNER_TTL_MS,
} from "@/hooks/useVerifiedBannerVisibility";

const USER = "usr_1";

describe("useVerifiedBannerVisibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("positive", () => {
    test("first view: shows the banner, sets the seen flag, then auto-hides after TTL", () => {
      const { result } = renderHook(() => useVerifiedBannerVisibility(true, USER));

      expect(result.current).toBe(true);
      expect(localStorage.getItem(verifiedBannerSeenKey(USER))).toBe("1");

      act(() => vi.advanceTimersByTime(KYC_VERIFIED_BANNER_TTL_MS));
      expect(result.current).toBe(false);
    });

    test("flag is set on first render, before the timer fires", () => {
      renderHook(() => useVerifiedBannerVisibility(true, USER));
      // Not advancing any timer — the seen flag must already be persisted.
      expect(localStorage.getItem(verifiedBannerSeenKey(USER))).toBe("1");
    });
  });

  describe("negative", () => {
    test("stays hidden when the user has already seen it", () => {
      localStorage.setItem(verifiedBannerSeenKey(USER), "1");
      const { result } = renderHook(() => useVerifiedBannerVisibility(true, USER));
      expect(result.current).toBe(false);
    });

    test("stays hidden when not enabled (non-VERIFIED status)", () => {
      const { result } = renderHook(() => useVerifiedBannerVisibility(false, USER));
      expect(result.current).toBe(false);
      expect(localStorage.getItem(verifiedBannerSeenKey(USER))).toBeNull();
    });

    test("stays hidden (and sets no flag) when userId is missing", () => {
      const { result } = renderHook(() => useVerifiedBannerVisibility(true, null));
      expect(result.current).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("flag is per user — a different VERIFIED user still sees it once", () => {
      localStorage.setItem(verifiedBannerSeenKey(USER), "1");
      const { result } = renderHook(() =>
        useVerifiedBannerVisibility(true, "usr_2"),
      );
      expect(result.current).toBe(true);
      expect(localStorage.getItem(verifiedBannerSeenKey("usr_2"))).toBe("1");
    });

    test("unmounting before the TTL clears the timer (no setState after unmount)", () => {
      const { unmount } = renderHook(() => useVerifiedBannerVisibility(true, USER));
      unmount();
      // The flag persisted, so the next visit will not re-show.
      expect(localStorage.getItem(verifiedBannerSeenKey(USER))).toBe("1");
      expect(() => act(() => vi.advanceTimersByTime(KYC_VERIFIED_BANNER_TTL_MS))).not.toThrow();
    });

    test("honors the usdx-mock-banner-ttl seam", () => {
      localStorage.setItem("usdx-mock-banner-ttl", "1000");
      const { result } = renderHook(() => useVerifiedBannerVisibility(true, USER));
      expect(result.current).toBe(true);

      act(() => vi.advanceTimersByTime(999));
      expect(result.current).toBe(true);
      act(() => vi.advanceTimersByTime(1));
      expect(result.current).toBe(false);
    });

    test("exports the default TTL constant", () => {
      expect(KYC_VERIFIED_BANNER_TTL_MS).toBe(5000);
    });
  });
});
