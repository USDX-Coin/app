import { cn } from "@/lib/utils";

/**
 * The auth logo, from the same files as the landing page (usdx.co.id):
 * `logo-lockup.png` (coin + wordmark) and `logo-coin.png`.
 *
 * `tone`:
 * - `page`  — on the page background: the landing lockup as-is.
 * - `brand` — on the maroon panel: the lockup's brown-gold wordmark would not
 *   read on #800000, so this keeps the landing coin plus live white text
 *   (8,6:1 on #800000).
 */
function UsdxMark({
  tone = "page",
  size = 32,
  className,
}: {
  tone?: "brand" | "page";
  /** Logo height in px. Figma: 44 on the desktop brand panel, 32 everywhere else. */
  size?: 32 | 44;
  className?: string;
}) {
  if (tone === "page") {
    return (
      <img
        src="/image/logo-lockup.png"
        alt="USDX"
        height={size}
        className={cn(size === 44 ? "h-11" : "h-8", "w-auto", className)}
      />
    );
  }
  return (
    <span
      className={cn("flex items-center", size === 44 ? "gap-3" : "gap-2", className)}
      // One accessible name for the pair; the coin itself is decoration.
      role="img"
      aria-label="USDX"
    >
      <img
        src="/image/logo-coin.png"
        alt=""
        aria-hidden
        width={size}
        height={size}
        className={size === 44 ? "size-11" : "size-8"}
      />
      <span
        aria-hidden
        className={cn(
          "font-semibold tracking-tight text-white",
          size === 44 ? "text-[28px] leading-8" : "text-xl leading-7"
        )}
      >
        USDX
      </span>
    </span>
  );
}

export { UsdxMark };
