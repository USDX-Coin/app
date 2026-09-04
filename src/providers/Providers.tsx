"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { Toaster } from "@/components/ui/sonner";
import { ApiClientBridge } from "@/components/system/ApiClientBridge";
import { isRateLimited } from "@/lib/api/errors";
import { dictionaries } from "@/lib/i18n/dictionaries";

// Central 429 RATE_LIMITED handling (USDX-252). The mint/redeem throughput
// throttle (5 req/s per user, conventions.md § Rate Limiting) can surface on any
// query (status-tracker poll) or mutation (create order). A QueryCache /
// MutationCache onError shows one debounced toast — central, and source-agnostic
// (fires for both the mock layer and the real backend, unlike a client.ts
// binding). Distinct from auth 429s (TOO_MANY_ATTEMPTS / TOO_MANY_REQUESTS),
// which keep their inline countdown. Never logs out (that's 401 only).
const RATE_LIMIT_TOAST_DEBOUNCE_MS = 3_000;

function makeRateLimitHandler() {
  let lastShownAt = 0;
  return (error: unknown) => {
    if (!isRateLimited(error)) return;
    const now = Date.now();
    if (now - lastShownAt < RATE_LIMIT_TOAST_DEBOUNCE_MS) return;
    lastShownAt = now;
    // Read the persisted language directly — this runs outside React context.
    const lang =
      typeof localStorage !== "undefined" && localStorage.getItem("usdx-lang") === "en"
        ? "en"
        : "id";
    toast.error(dictionaries[lang]["rate.limited"] ?? dictionaries.id["rate.limited"]);
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const onRateLimit = makeRateLimitHandler();
    return new QueryClient({
      queryCache: new QueryCache({ onError: onRateLimit }),
      mutationCache: new MutationCache({ onError: onRateLimit }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          // Don't retry a throttle — it just piles onto the limit. The poll
          // backs off to Retry-After instead (useRedeemTracker). Other errors
          // keep the single retry.
          retry: (failureCount, error) => !isRateLimited(error) && failureCount < 1,
        },
      },
    });
  });

  return (
    // `disableTransitionOnChange` is deliberately NOT set. It injects
    // `* { transition: none !important }` while the theme flips, which is
    // exactly the colour transition we want (globals.css `.theme-switching`).
    // `MotionConfig reducedMotion="user"` is the `motion` half of the reduced
    // motion story; the CSS half already runs off the `--dur-*` tokens.
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <MotionConfig reducedMotion="user">
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <ApiClientBridge />
            {children}
            <Toaster position="top-right" />
          </QueryClientProvider>
        </LanguageProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
