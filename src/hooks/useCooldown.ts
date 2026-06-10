"use client";

import { useEffect, useState } from "react";

// Ticking cooldown for rate-limited actions (USDX-150: 429 + Retry-After →
// countdown, sot/phase-2/week1.md error-handling rules). `start(seconds)` arms
// the countdown; `remaining` ticks down to 0 once per second.
export function useCooldown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return { remaining, active: remaining > 0, start: setRemaining };
}

// Fallback when the backend rate-limits without a usable Retry-After value.
export const DEFAULT_COOLDOWN_SECONDS = 60;
