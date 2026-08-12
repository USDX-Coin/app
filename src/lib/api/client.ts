// Thin fetch wrapper for the real backend (USDX-150, extended W2/USDX-205).
// Mirrors the back-office `apiFetch` so both consumer + backoffice share one
// mental model:
// - Prepends `env.apiBaseUrl` so requests hit the configured backend, not the FE origin.
// - Primary auth is the httpOnly session cookie (`credentials: "include"`, sent
//   cross-subdomain on `.usdx.co.id`); the `Authorization: Bearer <token>` header
//   (openapi global `security: [bearerAuth]`) is an in-memory fallback for
//   cross-site previews (`*.netlify.app`) where the cookie isn't delivered
//   (USDX-357/CLNT-12). The own-hosted checkout (`mint.usdx.co.id`) gets its own
//   session via a one-time-code URL-hash handoff (`#code=`), not this client
//   (USDX-378; supersede the cross-subdomain cookie USDX-222/226).
// - Unwraps the SoT `{ status, metadata, data }` envelope and returns `data`
//   (`apiFetch`), or keeps `metadata` for paginated lists (`apiFetchPaginated`).
// - Throws `ApiError` (SoT `ErrorResponse` shape) for non-2xx, parsing `Retry-After`.
// - Fires registered callbacks on 401 (`onUnauthorized`) and authenticated 403s
//   (`onForbidden`) so the session/account state can react without this module
//   taking a React/store dependency (avoids import cycles).

import { env } from "@/lib/env";

interface AuthBindings {
  getToken: () => string | null;
  onUnauthorized: () => void;
  // Fired before throwing on an *authenticated* 403, with the SoT error `code`.
  // Lets the host (ApiClientBridge) react to cross-cutting gating like
  // ACCOUNT_SUSPENDED that can surface on any consumer call. Optional so the
  // existing two-field `configureApiClient` call sites keep compiling.
  onForbidden?: (code: string) => void;
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

// SoT PaginatedResponse `metadata` (common.yaml#/schemas/PaginatedResponse).
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  metadata: PaginationMeta;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  // Send without an Authorization header (e.g. login / register / verify-email).
  // Also suppresses the `onForbidden` side-effect: public auth calls keep their
  // inline 403 handling (e.g. login's ACCOUNT_SUSPENDED banner).
  skipAuth?: boolean;
  // Suppress the global 401 → logout+redirect handler for this call. Use when a
  // 401 is an expected in-form outcome rather than an expired session — e.g.
  // change-password's 401 INVALID_CREDENTIALS (wrong current password, auth.yaml
  // changePasswordV2): the user stays logged in and we surface an inline error.
  skipUnauthorizedHandler?: boolean;
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

// Core request: builds headers, fetches, runs the 401/403 side-effects, parses
// JSON, and throws `ApiError` on non-2xx. Returns the parsed payload (or
// `undefined` for 204). Both `apiFetch` and `apiFetchPaginated` build on this so
// envelope unwrapping is the only thing that differs between them.
async function request(path: string, options: ApiFetchOptions = {}): Promise<unknown> {
  const { body, headers, skipAuth, skipUnauthorizedHandler, ...rest } = options;
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
    // USDX-357 (CLNT-12): primary auth is the httpOnly session cookie — `credentials:
    // "include"` sends it cross-subdomain (`.usdx.co.id`). The Bearer header above is a
    // fallback for cross-site previews (`*.netlify.app`) where the cookie isn't delivered;
    // that token lives in-memory only, never in localStorage.
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && !skipUnauthorizedHandler) {
    bindings.onUnauthorized();
  }

  if (response.status === 204) {
    return undefined;
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
    // Authenticated 403s may carry cross-cutting gating (ACCOUNT_SUSPENDED). Let
    // the host react before we throw. `skipAuth` calls (login/register/reset)
    // keep their inline handling and fire no global side-effect.
    if (response.status === 403 && !skipAuth) {
      bindings.onForbidden?.(code);
    }
    throw new ApiError(
      response.status,
      code,
      message,
      err.error?.details,
      parseRetryAfter(response.headers.get("Retry-After"), err.error?.details),
    );
  }

  return payload;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const payload = await request(path, options);
  if (payload === undefined) {
    return undefined as T;
  }
  // Tolerate handlers that haven't migrated to the SoT envelope yet.
  if (payload && typeof payload === "object" && "status" in (payload as object)) {
    return (payload as SoTSuccessEnvelope<T>).data;
  }
  return payload as T;
}

// Like `apiFetch` but preserves the SoT PaginatedResponse `metadata`
// (page/limit/total) alongside the `data` array — `apiFetch` unwraps to `data`
// and would drop it. Used by list endpoints that need a total for pagination
// (transactions.yaml, USDX-204). Falls back to sensible defaults when a handler
// omits metadata so callers never see undefined counts.
export async function apiFetchPaginated<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Paginated<T>> {
  const payload = (await request(path, options)) as
    | { data?: T[]; metadata?: Partial<PaginationMeta> }
    | undefined;
  const data = payload?.data ?? [];
  const meta = payload?.metadata ?? {};
  return {
    data,
    metadata: {
      page: meta.page ?? 1,
      limit: meta.limit ?? data.length,
      total: meta.total ?? data.length,
    },
  };
}
