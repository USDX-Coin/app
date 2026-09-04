"use client"

import * as React from "react"
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { useLang } from "@/providers/LanguageProvider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LinkInline } from "@/components/ui/link-inline"
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type KycStatus = "VERIFIED" | "PENDING" | "REJECTED" | "UNVERIFIED"

/**
 * MenuProfil — the avatar menu, identical on desktop and mobile.
 *
 * Presentational on purpose: it takes the user, the KYC status and callbacks,
 * and knows nothing about `useAuth` or the router. That keeps `components/ui/`
 * free of application state and lets Header and Sidebar wire the same menu two
 * different ways.
 *
 * Two things are deliberate rather than incidental:
 *  - Logging out always asks first. It is the one destructive action in the
 *    product and it sits one mis-tap away from "Profil".
 *  - Choosing a language or a theme does *not* close the menu; people usually
 *    change both in one go.
 *
 * REJECTED is shown as "belum verifikasi" with a link, not as a red dead end —
 * the reason for the rejection lives on the /kyc banner, not in a menu.
 */
function MenuProfil({
  name,
  email,
  kycStatus,
  lang,
  onLangChange,
  theme,
  onThemeChange,
  languages,
  themes,
  onProfile,
  onSettings,
  onVerify,
  onLogout,
  align = "start",
  side = "top",
  trigger,
  className,
}: {
  name: string
  email: string
  kycStatus: KycStatus
  lang: string
  onLangChange: (value: string) => void
  theme: string
  onThemeChange: (value: string) => void
  languages: Array<{ value: string; label: string }>
  themes: Array<{ value: string; label: string }>
  onProfile: () => void
  onSettings: () => void
  onVerify: () => void
  onLogout: () => void
  align?: "start" | "center" | "end"
  side?: "top" | "bottom"
  /** Custom trigger; the sidebar row by default. */
  trigger?: React.ReactNode
  className?: string
}) {
  const { t } = useLang()
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")

  const kycTone = {
    VERIFIED: "success",
    PENDING: "warning",
    REJECTED: "neutral",
    UNVERIFIED: "neutral",
  } as const
  const needsVerification = kycStatus === "REJECTED" || kycStatus === "UNVERIFIED"
  const kycLabel = t(
    `profile.kyc.${needsVerification ? "UNVERIFIED" : kycStatus}`
  )
  const currentLang = languages.find((l) => l.value === lang)?.label ?? lang
  const currentTheme = themes.find((x) => x.value === theme)?.label ?? theme

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <button
              type="button"
              // Sengaja TANPA `aria-label`: nama dan email yang terlihat di dalam tombol
              // inilah nama aksesibelnya. Label generik "Menu akun" akan MENIMPA keduanya,
              // sehingga pembaca layar kehilangan informasi siapa yang sedang login —
              // dan melanggar WCAG 2.5.3 (label yang terdengar harus memuat label yang
              // terlihat). Ikon chevron sudah `aria-hidden`.
              className={cn(
                "flex h-14 w-full items-center gap-3 rounded-lg px-3 text-left",
                "transition-control outline-none",
                "pointer-fine:hover:bg-accent data-[state=open]:bg-accent",
                "focus-visible:ring-2 focus-visible:ring-focus-ring",
                className
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm leading-5 font-medium text-muted-text">
                {initials}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm leading-5 font-medium">{name}</span>
                <span className="truncate text-xs leading-4 text-muted-text">{email}</span>
              </span>
              {/* A two-way chooser, not a Select — hence ChevronsUpDown. */}
              <ChevronsUpDown className="size-4 shrink-0 text-muted-text" />
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent side={side} align={align}>
          <div className="flex items-center gap-3 p-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm leading-5 font-medium text-muted-text">
              {initials}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm leading-5 font-medium">{name}</span>
              <span className="truncate text-xs leading-4 text-muted-text">{email}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 px-2 pb-2">
            <Badge tone={kycTone[kycStatus]}>{kycLabel}</Badge>
            {needsVerification && (
              <LinkInline
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  onVerify()
                }}
                className="text-sm"
              >
                {t("profile.menu.verifyNow")}
              </LinkInline>
            )}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onProfile}>
            <User />
            {t("profile.menu.profile")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSettings}>
            <Settings />
            {t("profile.menu.settings")}
            <Badge tone="coming-soon" className="ml-auto">
              {t("common.comingSoon")}
            </Badge>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("profile.menu.language")}
              <span className="ml-auto text-sm leading-5 text-muted-text">{currentLang}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={lang} onValueChange={onLangChange}>
                {languages.map((l) => (
                  <DropdownMenuRadioItem
                    key={l.value}
                    value={l.value}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {l.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("profile.menu.theme")}
              <span className="ml-auto text-sm leading-5 text-muted-text">{currentTheme}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={onThemeChange}>
                {themes.map((x) => (
                  <DropdownMenuRadioItem
                    key={x.value}
                    value={x.value}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {x.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem tone="destructive" onSelect={() => setConfirmOpen(true)}>
            <LogOut />
            {t("profile.menu.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t("profile.menu.logoutTitle")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>{t("profile.menu.logoutBody")}</DialogDescription>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="flex-1"
              onClick={() => {
                setConfirmOpen(false)
                onLogout()
              }}
            >
              {t("profile.menu.logout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { MenuProfil }
export type { KycStatus }
