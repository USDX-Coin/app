"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { springSnappy } from "@/lib/motion";
import { useThemeSwitch } from "@/hooks/useThemeSwitch";
import { useLang } from "@/providers/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setThemeWithTransition } = useThemeSwitch();
  const { t } = useLang();
  const [mounted, setMounted] = useState(false);

  // next-themes only knows the real theme after mount; guard against hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const label = isDark ? t("theme.toLight") : t("theme.toDark");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={() => setThemeWithTransition(isDark ? "light" : "dark")}
          className={cn("border border-border text-muted-text", className)}
        >
          {/* Cross-fade plus a quarter turn: the icon changes meaning, so it
              should look like it turned into the other one rather than being
              swapped out. 2-D rotation on a 16 px glyph, not a 3-D flip. */}
          <span className="relative flex size-4 items-center justify-center">
            <AnimatePresence initial={false} mode="wait">
              {mounted && (
                <motion.span
                  key={isDark ? "sun" : "moon"}
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={springSnappy}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
