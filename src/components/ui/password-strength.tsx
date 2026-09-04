"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * PasswordStrength — four segments, one per rule the password already meets.
 *
 * This exists because the password field is the one place where a static
 * placeholder cannot do the job: the user needs to see the rules being met as
 * they type, not a paragraph of requirements sitting under an empty box.
 *
 * Register and reset-password only. Never on login — telling someone their
 * existing password is "weak" while they are trying to get in is noise at the
 * worst possible moment.
 *
 * The rules come from the caller (`validations.ts` owns them), and so do the
 * labels, because they are translated.
 */
const TONES = [
  { bar: "bg-destructive", text: "text-destructive-text" },
  { bar: "bg-warning", text: "text-warning-text" },
  { bar: "bg-success", text: "text-success-text" },
] as const

function PasswordStrength({
  className,
  score,
  total = 4,
  label,
  id,
  ...props
}: React.ComponentProps<"div"> & {
  /** How many rules are satisfied, 0–`total`. */
  score: number
  total?: number
  /** "Lemah" / "Sedang" / "Kuat", already translated. Omitted at score 0. */
  label?: React.ReactNode
}) {
  const filled = Math.max(0, Math.min(score, total))
  // 1–2 weak · 3 medium · 4 strong.
  const tone = filled === 0 ? null : TONES[Math.min(Math.ceil(filled / 2) - 1, 2)]

  return (
    <div data-slot="password-strength" className={cn("flex flex-col gap-1.5", className)} {...props}>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-control",
              i < filled && tone ? tone.bar : "bg-muted"
            )}
          />
        ))}
      </div>
      {filled > 0 && label && (
        <p
          id={id}
          aria-live="polite"
          className={cn("text-sm leading-5", tone?.text)}
        >
          {label}
        </p>
      )}
    </div>
  )
}

export { PasswordStrength }
