"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { AutoHeight } from "@/components/animate-ui/primitives/effects/auto-height"
import { springHeight } from "@/lib/motion"

/**
 * Field — one anatomy for every form row: label → control → one help line.
 *
 * Spacing is owned here, not written per form: 6 px label→control, 4 px
 * control→help. Both come from the label's own bottom margin and the help
 * line's own top padding, never from a container `gap` — a gap on the Field
 * would still be paid when the help line renders nothing.
 *
 * The help line is a single slot that changes role (hint → error), not two
 * stacked elements. Two elements mean two reserved boxes, and a form of six
 * fields quietly loses 144 px to space it never uses.
 */
function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6",
        "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-3 font-medium",
        "data-[variant=legend]:text-base",
        "data-[variant=label]:text-sm",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-4 data-[slot=checkbox-group]:gap-3",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva("group/field flex w-full data-[invalid=true]:text-destructive-text", {
  variants: {
    orientation: {
      vertical: [
        "flex-col [&>*]:w-full [&>.sr-only]:w-px",
        // ② 6 px label → control. Lives on the label, so it disappears with it.
        "[&>[data-slot=field-label]]:mb-1.5",
        // ④ 4 px control → help, for the parts used without `FieldHelp`.
        "[&>[data-slot=field-description]]:pt-1 [&>[data-slot=field-error]]:pt-1",
      ],
      horizontal: [
        "flex-row items-center gap-3",
        "[&>[data-slot=field-label]]:flex-auto",
        "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      ],
      responsive: [
        "flex-col gap-1.5 @md/field-group:flex-row @md/field-group:items-center @md/field-group:gap-3 [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-px",
        "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
      ],
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
})

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("group/field-content flex flex-1 flex-col gap-1 leading-snug", className)}
      {...props}
    />
  )
}

/**
 * Label/Field, 14/20 medium. No asterisk anywhere: a field without a suffix is
 * required, and the ones that are not say "(opsional)". `required` still goes on
 * the control itself, for assistive tech.
 */
function FieldLabel({
  className,
  children,
  optional = false,
  optionalLabel = "(opsional)",
  ...props
}: React.ComponentProps<typeof Label> & {
  optional?: boolean
  optionalLabel?: React.ReactNode
}) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-1 text-sm leading-5 font-medium text-foreground",
        "group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {optional && <span className="font-normal text-muted-text">{optionalLabel}</span>}
    </Label>
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-title"
      className={cn(
        "flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

/** Body/Sm helper text. No trailing full stop when it is a single phrase. */
function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-sm leading-5 font-normal text-muted-text",
        "[&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { children?: React.ReactNode }) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn("relative -my-2 h-5 text-sm", className)}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-text"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

/**
 * The error half of the help line. Renders nothing at all when there is no
 * message — no wrapper, no `min-h`, no reserved 24 px. (The component this
 * replaces, `ui/field-error.tsx`, reserved that space permanently; every form
 * in the app paid for it.)
 */
function FieldError({
  className,
  children,
  message,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  /** Single message — the shape the project's `validations.ts` returns. */
  message?: string | null
  /** Several messages, de-duplicated and listed. */
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = React.useMemo(() => {
    if (children) return children
    if (message) return message
    if (!errors?.length) return null

    const unique = [...new Map(errors.map((e) => [e?.message, e])).values()].filter(
      (e) => e?.message
    )
    if (unique.length === 0) return null
    if (unique.length === 1) return unique[0]?.message

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {unique.map((e, i) => (
          <li key={i}>{e?.message}</li>
        ))}
      </ul>
    )
  }, [children, message, errors])

  if (!content) return null

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-sm leading-5 font-normal text-destructive-text", className)}
      {...props}
    >
      {content}
    </div>
  )
}

/**
 * The help line itself — ⑤ in the anatomy. One slot, two possible roles: it
 * shows the hint until there is an error, then shows the error instead.
 *
 * Height is animated rather than reserved: 220 ms in, 150 ms out via
 * `springHeight`. When both hint and error are empty the wrapper measures 0 and
 * the Field is exactly as tall as label + control.
 */
function FieldHelp({
  className,
  id,
  hint,
  error,
}: {
  className?: string
  /** Used to build `<id>-hint` / `<id>-error` for `aria-describedby`. */
  id?: string
  hint?: React.ReactNode
  error?: string | null
}) {
  const showError = Boolean(error)

  return (
    <AutoHeight
      data-slot="field-help"
      deps={[error, hint]}
      transition={springHeight}
      className={cn("w-full", className)}
    >
      {showError ? (
        // ④ 4 px from the control; it exists only while the text does.
        <FieldError className="pt-1" id={id ? `${id}-error` : undefined}>
          {error}
        </FieldError>
      ) : hint ? (
        <FieldDescription className="pt-1" id={id ? `${id}-hint` : undefined}>
          {hint}
        </FieldDescription>
      ) : null}
    </AutoHeight>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldHelp,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}
