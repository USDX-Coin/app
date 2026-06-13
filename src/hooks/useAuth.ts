"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import * as authApi from "@/lib/api/auth-api";
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
export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (req: LoginRequest) => authApi.login(req),
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      router.push("/mint");
    },
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
    register: registerMutation.mutateAsync,
    verifyEmail: verifyEmailMutation.mutateAsync,
    resendVerification: resendVerificationMutation.mutateAsync,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    logout,
    loginLoading: loginMutation.isPending,
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
