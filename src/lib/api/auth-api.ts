// Auth API (USDX-150). Single entry point the app calls for auth; internally
// routes to the real backend (/api/v2/auth/*) or the mock layer based on `env.useMock`.
// Replaces the old direct `mockLogin`/`mockRegister` imports.

import { env } from "@/lib/env";
import { apiFetch } from "./client";
import type { AuthResponse, RegisterResult, User } from "@/types";
import type {
  LoginRequest,
  RegisterRequest,
  VerifyEmailRequest,
  ResendVerificationRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "./types";
import {
  mockLogin,
  mockRegister,
  mockVerifyEmail,
  mockResendVerification,
  mockForgotPassword,
  mockResetPassword,
  mockGetMe,
  mockLogout,
} from "./mock-api";

// openapi AuthTokenV2 — Better Auth issues a session via cookie or access token.
interface AuthTokenV2 {
  accessToken: string | null;
  sessionId: string;
  user: User;
}

// Normalize the backend session payload to the Bearer credential the app stores.
// Cookie-only audiences return accessToken=null; we fall back to sessionId so the
// client still has something to attach (and the cookie rides along regardless).
function toAuthResponse(data: AuthTokenV2): AuthResponse {
  return { user: data.user, token: data.accessToken ?? data.sessionId };
}

export async function login(req: LoginRequest): Promise<AuthResponse> {
  if (env.useMock) return mockLogin(req);
  const data = await apiFetch<AuthTokenV2>("/api/v2/auth/login", {
    method: "POST",
    body: req,
    skipAuth: true,
  });
  return toAuthResponse(data);
}

export async function register(req: RegisterRequest): Promise<RegisterResult> {
  if (env.useMock) return mockRegister(req);
  return apiFetch<RegisterResult>("/api/v2/auth/register", {
    method: "POST",
    body: req,
    skipAuth: true,
  });
}

export async function verifyEmail(req: VerifyEmailRequest): Promise<AuthResponse> {
  if (env.useMock) return mockVerifyEmail(req);
  const data = await apiFetch<AuthTokenV2>("/api/v2/auth/verify-email", {
    method: "POST",
    body: req,
    skipAuth: true,
  });
  return toAuthResponse(data);
}

export async function resendVerification(req: ResendVerificationRequest): Promise<void> {
  if (env.useMock) return mockResendVerification();
  await apiFetch<unknown>("/api/v2/auth/resend-verification", {
    method: "POST",
    body: req,
    skipAuth: true,
  });
}

export async function forgotPassword(req: ForgotPasswordRequest): Promise<void> {
  if (env.useMock) return mockForgotPassword();
  await apiFetch<unknown>("/api/v2/auth/forgot-password", {
    method: "POST",
    body: req,
    skipAuth: true,
  });
}

export async function resetPassword(req: ResetPasswordRequest): Promise<AuthResponse> {
  if (env.useMock) return mockResetPassword(req);
  const data = await apiFetch<AuthTokenV2>("/api/v2/auth/reset-password", {
    method: "POST",
    body: req,
    skipAuth: true,
  });
  return toAuthResponse(data);
}

export async function getMe(): Promise<User> {
  if (env.useMock) return mockGetMe();
  return apiFetch<User>("/api/v2/auth/me", { method: "GET" });
}

// Revoke the current Better Auth session (auth.yaml § logoutV2, USDX-166).
// Current session only — other devices stay logged in. Callers fire-and-forget:
// local logout (clear token + redirect) must never block on this call, and a
// 401 here just means the session is already gone (double logout per contract).
export async function logout(): Promise<void> {
  if (env.useMock) return mockLogout();
  await apiFetch<void>("/api/v2/auth/logout", { method: "POST" });
}
