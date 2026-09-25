"use client";

// Login langkah 2 pada akun ber-2FA (auth.yaml § loginV2 → two-factor.yaml §
// verifyLogin, USDX-714 — menutup GAP 22 Sep). Tampil menggantikan form password
// sesudah backend menjawab `{ twoFactorRequired: true }`.
//
// Dua tahap:
// - `code` — kode authenticator 6 digit ATAU backup code → `verifyTwoFactorLogin`;
//   suksesnya = login (useAuth mendarat, termasuk niat login ulang lupa-PIN /
//   Buat PIN).
// - `recovery` — "Tidak bisa akses authenticator?": kirim OTP ke email → masukkan
//   OTP → 2FA DIMATIKAN. Backend tidak menerbitkan token di sini, jadi langkah ini
//   login ulang sendiri dengan email + password yang baru saja diketik (masih di
//   memori komponen, tidak disimpan ke mana pun). Peringatan kunci 24 jam
//   (custodial-wallet.md §6.1 no.6) tampil SEBELUM user mengirim maupun
//   mengonfirmasi.
//
// Challenge (cookie `two_factor`, 10 menit, sekali pakai) kedaluwarsa → kembali
// ke form password (`onExpired`). 429 → hitung mundur dari Retry-After di tombol.

import { useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TwoFactorCodeField } from "@/components/shared/TwoFactorCodeField";
import { useAuth } from "@/hooks/useAuth";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";
import { isTwoFactorRequired } from "@/lib/api/auth-api";
import {
  getFailureText,
  getRateLimitSeconds,
  isInvalidTwoFactorCode,
  isTwoFactorChallengeExpired,
} from "@/lib/api/errors";
import { formatDuration } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";

export interface TwoFactorLoginStepProps {
  email: string;
  password: string;
  /** "Kembali ke login" — form password lagi. */
  onBack: () => void;
  /** Challenge hilang/kedaluwarsa — form password lagi, dengan kalimatnya. */
  onExpired: () => void;
}

const HEADING = "text-2xl leading-8 font-semibold tracking-tight text-foreground";

export function TwoFactorLoginStep({ email, password, onBack, onExpired }: TwoFactorLoginStepProps) {
  const { t, lang } = useLang();
  const auth = useAuth();
  const cooldown = useCooldown();
  const [stage, setStage] = useState<"code" | "recovery">("code");
  const [code, setCode] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const cooldownLabel = t("auth.tryAgainIn", { duration: formatDuration(cooldown.remaining, lang) });

  // Satu tempat untuk jawaban yang sama di kedua tahap.
  function handleError(err: unknown, wrongCodeKey: string) {
    if (isTwoFactorChallengeExpired(err)) {
      onExpired();
      return;
    }
    const retryAfter = getRateLimitSeconds(err);
    if (retryAfter !== null) {
      cooldown.start(retryAfter > 0 ? retryAfter : DEFAULT_COOLDOWN_SECONDS);
      return;
    }
    if (isInvalidTwoFactorCode(err)) {
      setErrorKey(wrongCodeKey);
      return;
    }
    toast.error(getFailureText(t, err, "twoFactor.errFailed"));
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code) {
      setErrorKey("auth.2fa.errRequired");
      return;
    }
    setErrorKey(null);
    try {
      await auth.verifyTwoFactorLogin(code);
    } catch (err) {
      handleError(err, "twoFactor.errCode");
    }
  }

  async function sendOtp() {
    setErrorKey(null);
    try {
      await auth.requestTwoFactorRecovery();
      setOtpSent(true);
      toast.success(t("auth.2fa.recovery.sent"));
    } catch (err) {
      handleError(err, "auth.2fa.recovery.errCode");
    }
  }

  async function confirmOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) {
      setErrorKey("auth.2fa.errRequired");
      return;
    }
    setErrorKey(null);
    try {
      await auth.confirmTwoFactorRecovery(otp);
    } catch (err) {
      handleError(err, "auth.2fa.recovery.errCode");
      return;
    }
    // 2FA sudah mati — login biasa kini langsung menerbitkan sesi dan mendarat.
    toast.success(t("auth.2fa.recovery.done"));
    try {
      const result = await auth.login({ email, password });
      if (isTwoFactorRequired(result)) setStage("code");
    } catch {
      onBack();
    }
  }

  function switchStage(next: "code" | "recovery") {
    setErrorKey(null);
    setStage(next);
  }

  const backToLogin = (
    <Button type="button" variant="link" className="self-start px-0" onClick={onBack}>
      {t("auth.2fa.back")}
    </Button>
  );

  if (stage === "recovery") {
    return (
      <div className="flex flex-col gap-6" data-testid="two-factor-recovery">
        <div className="flex flex-col gap-1.5">
          <h1 className={HEADING}>{t("auth.2fa.recovery.title")}</h1>
          <p className="text-sm leading-5 text-muted-text">{t("auth.2fa.recovery.desc")}</p>
        </div>

        <Alert tone="warning" data-testid="two-factor-recovery-warning">
          {t("auth.2fa.recovery.lockWarning")}
        </Alert>

        {otpSent ? (
          <form onSubmit={confirmOtp} className="flex flex-col gap-4">
            <TwoFactorCodeField
              id="two-factor-recovery-otp"
              kind="totp"
              label={t("auth.2fa.recovery.code")}
              value={otp}
              onChange={setOtp}
              autoFocus
              disabled={auth.confirmTwoFactorRecoveryLoading || auth.loginLoading}
              error={errorKey ? t(errorKey) : null}
            />
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full"
              loading={auth.confirmTwoFactorRecoveryLoading || auth.loginLoading}
              loadingLabel={t("auth.2fa.recovery.confirming")}
              cooldownSeconds={cooldown.remaining}
              cooldownLabel={cooldownLabel}
            >
              {t("auth.2fa.recovery.confirm")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={sendOtp}
              loading={auth.requestTwoFactorRecoveryLoading}
              loadingLabel={t("auth.2fa.recovery.sending")}
              disabled={cooldown.active}
            >
              {t("auth.2fa.recovery.resend")}
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            variant="brand"
            size="lg"
            className="w-full"
            onClick={sendOtp}
            loading={auth.requestTwoFactorRecoveryLoading}
            loadingLabel={t("auth.2fa.recovery.sending")}
            cooldownSeconds={cooldown.remaining}
            cooldownLabel={cooldownLabel}
          >
            {t("auth.2fa.recovery.send")}
          </Button>
        )}

        <div className="flex flex-col items-start gap-1">
          <Button type="button" variant="link" className="px-0" onClick={() => switchStage("code")}>
            {t("auth.2fa.recovery.useApp")}
          </Button>
          {backToLogin}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="two-factor-login">
      <div className="flex flex-col gap-1.5">
        <h1 className={HEADING}>{t("auth.2fa.title")}</h1>
        <p className="text-sm leading-5 text-muted-text">{t("auth.2fa.desc")}</p>
      </div>

      <form onSubmit={submitCode} className="flex flex-col gap-4">
        <TwoFactorCodeField
          id="two-factor-login-code"
          kind="any"
          label={t("auth.2fa.code")}
          value={code}
          onChange={setCode}
          autoFocus
          disabled={auth.verifyTwoFactorLoginLoading}
          error={errorKey ? t(errorKey) : null}
        />
        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          loading={auth.verifyTwoFactorLoginLoading}
          loadingLabel={t("auth.2fa.submitting")}
          cooldownSeconds={cooldown.remaining}
          cooldownLabel={cooldownLabel}
        >
          {t("auth.2fa.submit")}
        </Button>
      </form>

      <div className="flex flex-col items-start gap-1">
        <Button type="button" variant="link" className="px-0" onClick={() => switchStage("recovery")}>
          {t("auth.2fa.cantAccess")}
        </Button>
        {backToLogin}
      </div>
    </div>
  );
}
