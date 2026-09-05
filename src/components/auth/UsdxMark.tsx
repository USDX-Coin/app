import { cn } from "@/lib/utils";

/**
 * The auth logo — coin vector + the word "USDX" set in the UI font.
 *
 * Figma 30 A (finding E5): `usdx-wordmark.png` is a *dark* raster. On the maroon
 * brand panel it reads at roughly 1,3:1 — the screenshot in the audit shows a
 * logo that is there but cannot be read. There has never been a light variant of
 * that file, and the pattern every other surface already uses is this one: the
 * coin as SVG plus live text whose colour follows the surface. So the wordmark
 * raster is gone from auth; `usdx-coin.svg` (the same 2,3 kB file the checkout
 * app ships) plus a `<span>` replaces it.
 *
 * `tone`:
 * - `brand`  — on the maroon panel: white text (8,6:1 on #800000).
 * - `page`   — on the page background: `foreground`, so it follows the theme.
 */
function UsdxMark({
  tone = "page",
  size = 32,
  className,
}: {
  tone?: "brand" | "page";
  /** Coin edge in px. Figma: 44 on the desktop brand panel, 32 everywhere else. */
  size?: 32 | 44;
  className?: string;
}) {
  return (
    <span
      className={cn("flex items-center", size === 44 ? "gap-3" : "gap-2", className)}
      // One accessible name for the pair; the coin itself is decoration.
      role="img"
      aria-label="USDX"
    >
      <img
        src="/image/usdx-coin.svg"
        alt=""
        aria-hidden
        width={size}
        height={size}
        className={size === 44 ? "size-11" : "size-8"}
      />
      <span
        aria-hidden
        className={cn(
          "font-semibold tracking-tight",
          size === 44 ? "text-[28px] leading-8" : "text-xl leading-7",
          tone === "brand" ? "text-white" : "text-foreground"
        )}
      >
        USDX
      </span>
    </span>
  );
}

export { UsdxMark };
