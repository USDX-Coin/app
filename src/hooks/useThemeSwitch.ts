"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";

/**
 * Theme switching with a colour transition.
 *
 * `next-themes` flips a class on <html> and every token changes at once, which
 * reads as a snap. The fix is a class that is only present *while* the change
 * happens: `globals.css` gives `html.theme-switching *` a 150 ms transition on
 * colour properties only. Mounting that transition permanently would slow every
 * hover in the app from 90 ms to 150.
 *
 * Reduced motion needs nothing here — `--dur-2` is already 0 ms inside the
 * `prefers-reduced-motion` block.
 *
 * There is a second theme trigger (the Tema submenu in the account menu), so
 * this lives in a hook rather than inside `ThemeToggle`.
 */
const THEME_TRANSITION_MS = 200; // 150 ms of transition + a small margin

export function useThemeSwitch() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const setThemeWithTransition = useCallback(
    (next: string) => {
      const root = document.documentElement;
      root.classList.add("theme-switching");
      setTheme(next);

      // Repeated clicks must not leave the class stuck on <html>.
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        root.classList.remove("theme-switching");
        timeoutRef.current = null;
      }, THEME_TRANSITION_MS);
    },
    [setTheme]
  );

  return { theme, resolvedTheme, setThemeWithTransition };
}
