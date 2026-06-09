// Thin fetch wrapper for the real backend (USDX-150). Mirrors the back-office
// `apiFetch` so both consumer + backoffice share one mental model:
// - Prepends `env.apiBaseUrl` so requests hit the configured backend, not the FE origin.
// - Attaches `Authorization: Bearer <token>` (openapi global `security: [bearerAuth]`).
// - Unwraps the SoT `{ status, metadata, data }` envelope and returns `data`.
// - Throws `ApiError` (SoT `ErrorResponse` shape) for non-2xx, parsing `Retry-After`.
// - Fires a registered `onUnauthorized` callback on 401 so the session can clear
//   without this module taking a React/store dependency (avoids import cycles).

import { env } from "@/lib/env";

interface AuthBindings {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

let bindings: AuthBindings = {
  getToken: () => null,
  onUnauthorized: () => {},
};

export function configureApiClient(next: AuthBindings) {
  bindings = next;
}

export class ApiError extends Error {
  status: number;
  code: string;
  // Per-error-code structured payload (e.g. EMAIL_NOT_VERIFIED → { resendUrl },
  // TOO_MANY_REQUESTS → { retryAfterSeconds }). Shape varies by `code`; callers narrow.
  details: unknown;
  // Parsed from the `Retry-After` response header when present (429s).
  retryAfterSeconds: number | null;

  constructor(
    status: number,
    code: string,
    message: string,
    details: unknown = undefined,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface SoTSuccessEnvelope<T> {
  status: "success";
  metadata?: unknown;
  data: T;
}

interface SoTErrorEnvelope {
  status?: "error";
  error?: { code?: string; message?: string; details?: unknown };
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  // Send without an Authorization header (e.g. login / register / verify-email).
  skipAuth?: boolean;
}

function parseRetryAfter(header: string | null, details: unknown): number | null {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds;
  }
  // Some endpoints also surface it in the error body (auth.yaml resendVerificationV2).
  if (details && typeof details === "object" && "retryAfterSeconds" in details) {
    const value = (details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    if (typeof value === "number") return value;
  }
  return null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, skipAuth, ...rest } = options;
  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (!skipAuth) {
    const token = bindings.getToken();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401) {
    bindings.onUnauthorized();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const err = (payload ?? {}) as SoTErrorEnvelope;
    const code = err.error?.code ?? "UNKNOWN";
    const message = err.error?.message ?? response.statusText ?? "Request failed";
    throw new ApiError(
      response.status,
      code,
      message,
      err.error?.details,
      parseRetryAfter(response.headers.get("Retry-After"), err.error?.details),
    );
  }

  // Tolerate handlers that haven't migrated to the SoT envelope yet.
  if (payload && typeof payload === "object" && "status" in (payload as object)) {
    return (payload as SoTSuccessEnvelope<T>).data;
  }
  return payload as T;
}
