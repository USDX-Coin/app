"use client";

import { useEffect, useState } from "react";

// Ticking cooldown for rate-limited actions (USDX-150: 429 + Retry-After →
// countdown, sot/phase-2/week1.md error-handling rules). `start(seconds)` arms
// the countdown. ≤60s ticks once per second; longer waits sleep straight to the
// next formatDuration display change (USDX-167) — a 22-hour cooldown re-renders
// when the hour count drops, not 79k times.
export function useCooldown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const step = nextStepSeconds(remaining);
    const timer = setTimeout(() => setRemaining((s) => Math.max(0, s - step)), step * 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return { remaining, active: remaining > 0, start: setRemaining };
}

// Seconds until the formatted unit count drops: to the previous hour boundary
// while > 1h, minute boundary while > 60s, else 1s. Ceil-based display means the
// label changes exactly when `remaining` crosses a unit multiple.
function nextStepSeconds(remaining: number): number {
  if (remaining > 3600) return ((remaining - 1) % 3600) + 1;
  if (remaining > 60) return ((remaining - 1) % 60) + 1;
  return 1;
}

// Fallback when the backend rate-limits without a usable Retry-After value.
export const DEFAULT_COOLDOWN_SECONDS = 60;
