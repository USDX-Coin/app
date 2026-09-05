import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Daftar/Poin — Figma 30 E.
 *
 * The help boxes on "Cek email" (33) and "Akun ditangguhkan" (37) used to mark
 * each line with an em dash. Three markers were tried on the same box: numbers
 * (imply an order that is not there — that is what `Steps` is for), a bordered
 * definition list (a made-up label that repeats the sentence), and a meaningful
 * icon per line. The icon won: every row is a different idea, so the glyph is a
 * handle on the row before the sentence is read.
 *
 * Geometry from the board: 24 px circle (card fill, 1 px border), 16 px icon,
 * 12 px to the text, 10 px between rows, Body/Sm foreground. The optional link
 * sits on its own line under the sentence.
 */
function HintBox({
  title,
  className,
  children,
}: {
  title: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl bg-muted p-4 text-left", className)}>
      <p className="text-sm leading-5 font-medium text-foreground">{title}</p>
      <ul className="mt-2.5 flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function HintRow({
  icon,
  children,
  action,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  /** Rendered on its own line under the sentence — a `LinkInline`, normally. */
  action?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground [&_svg]:size-4"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-5 text-foreground">
        {children}
        {action && <span className="mt-0.5 block">{action}</span>}
      </span>
    </li>
  );
}

export { HintBox, HintRow };
