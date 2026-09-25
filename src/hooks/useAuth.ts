"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import * as authApi from "@/lib/api/auth-api";
import { recoverTwoFactorViaEmail, verifyTwoFactorLogin } from "@/lib/api/two-factor-api";
import { reloginLanding } from "@/lib/auth/relogin-intent";
import type {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  VerifyEmailRequest,
} from "@/lib/api/types";

// Orchestrates the consumer auth flow (USDX-150): wires the auth API to the store
// and post-action navigation. Register no longer auto-logs in — the user must verify
// their email first, so it routes to /register/check-email. Login / verify-email /
// reset-password issue a session and land on the dashboard.
//
// Verify-email used to land a new account on the "dikasih wallet" step
// (/onboarding/wallet, USDX-566). That redirect is switched off in every
// environment (custodial-wallet.md §1, amandemen 14 Sep 2026): verify-email lands
// on /mint like login and reset-password.
//
// A login that follows a "Login ulang" button (lib/auth/relogin-intent, USDX-697)
// lands on that intent's screen instead of /mint; the screen takes the intent.
//
// 2FA (USDX-714, auth.yaml § loginV2): on a 2FA account `login` answers
// `{ twoFactorRequired }` and does nothing else; `verifyTwoFactorLogin` is the step
// that issues the session and lands.

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();

  // Akun ber-2FA: langkah 1 hanya `{ twoFactorRequired }` — belum ada sesi, jadi
  // store dan navigasi tidak disentuh; pemanggil (LoginForm) menampilkan layar kode.
  const loginMutation = useMutation({
    mutationFn: (req: LoginRequest) => authApi.login(req),
    onSuccess: (data) => {
      if (authApi.isTwoFactorRequired(data)) return;
      setAuth(data.user, data.token);
      router.push(reloginLanding() ?? "/mint");
    },
  });

  // Login langkah 2 (two-factor.yaml § verifyLogin): INI login-nya — sesi + pendaratan
  // yang sama dengan login biasa, termasuk niat login ulang (lupa-PIN / Buat PIN).
  const verifyTwoFactorLoginMutation = useMutation({
    mutationFn: (code: string) => verifyTwoFactorLogin({ code }),
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      router.push(reloginLanding() ?? "/mint");
    },
  });

  // Pemulihan via email (two-factor.yaml § recoveryEmail): kirim OTP, lalu
  // verifikasi → 2FA mati. Tidak ada token di sini — pemanggil login ulang.
  const requestRecoveryMutation = useMutation({
    mutationFn: () => recoverTwoFactorViaEmail(),
  });
  const confirmRecoveryMutation = useMutation({
    mutationFn: (code: string) => recoverTwoFactorViaEmail(code),
  });

  const registerMutation = useMutation({
    mutationFn: (req: RegisterRequest) => authApi.register(req),
    onSuccess: (data) => {
      router.push(`/register/check-email?email=${encodeURIComponent(data.email)}`);
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: (req: VerifyEmailRequest) => authApi.verifyEmail(req),
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      router.push("/mint");
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: (req: ResendVerificationRequest) => authApi.resendVerification(req),
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (req: ForgotPasswordRequest) => authApi.forgotPassword(req),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (req: ResetPasswordRequest) => authApi.resetPassword(req),
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      router.push("/mint");
    },
  });

  // In-app password change (USDX-173). No navigation/re-login on success — the
  // current session stays valid (BE keeps it, revoking other devices). The modal
  // owns the success toast + inline error mapping, so this is a bare mutation.
  const changePasswordMutation = useMutation({
    mutationFn: (req: ChangePasswordRequest) => authApi.changePassword(req),
  });

  function logout() {
    storeLogout();
    router.push("/login");
  }

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutateAsync,
    verifyTwoFactorLogin: verifyTwoFactorLoginMutation.mutateAsync,
    requestTwoFactorRecovery: requestRecoveryMutation.mutateAsync,
    confirmTwoFactorRecovery: confirmRecoveryMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    verifyEmail: verifyEmailMutation.mutateAsync,
    resendVerification: resendVerificationMutation.mutateAsync,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    logout,
    loginLoading: loginMutation.isPending,
    verifyTwoFactorLoginLoading: verifyTwoFactorLoginMutation.isPending,
    requestTwoFactorRecoveryLoading: requestRecoveryMutation.isPending,
    confirmTwoFactorRecoveryLoading: confirmRecoveryMutation.isPending,
    registerLoading: registerMutation.isPending,
    verifyEmailLoading: verifyEmailMutation.isPending,
    resendVerificationLoading: resendVerificationMutation.isPending,
    forgotPasswordLoading: forgotPasswordMutation.isPending,
    resetPasswordLoading: resetPasswordMutation.isPending,
    changePasswordLoading: changePasswordMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    verifyEmailError: verifyEmailMutation.error,
    resetPasswordError: resetPasswordMutation.error,
  };
}
