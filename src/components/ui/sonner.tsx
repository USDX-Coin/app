"use client"

import { CircleAlert, CircleCheck, Info } from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Toast — a moment that just happened because the user did something: saved,
 * deleted, failed to save, session expired. It leaves on its own.
 *
 * Three tones only: success · error · info. There is deliberately **no
 * warning tone**. The rule is "Toast = a passing event, Alert = a state that
 * stays", and a warning is always a state that stays — so its home is `Alert`.
 * Do not add one here because Alert has four.
 *
 * `richColors` is off: the tone is carried by the icon, and the surface stays a
 * plain popover. A toast floats over arbitrary content, and a tinted panel is
 * the one thing guaranteed to clash with something underneath it.
 *
 * Never fires from the API layer. `errors.ts` throws `ApiError`; only a form or
 * a page decides whether that deserves a toast, an Alert or a FieldError —
 * which is how one 429 stopped producing two toasts.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      visibleToasts={3}
      icons={{
        success: <CircleCheck className="size-4 text-success-text" />,
        info: <Info className="size-4 text-info-text" />,
        error: <CircleAlert className="size-4 text-destructive-text" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-md",
          title: "!text-sm !leading-5 !font-medium !text-foreground",
          description: "!text-sm !leading-5 !text-muted-text",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.75rem",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
