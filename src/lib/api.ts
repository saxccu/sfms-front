import { clearAccessToken, getAccessToken } from "./storage";

/**
 * Public API of the hosted deployment. Used as the fallback when the app
 * runs on the hosted frontend (Netlify) and no VITE_API_BASE_URL is set.
 */
const PRODUCTION_API_URL = "https://saxccudrive.onrender.com";

const configuredBaseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL;

function resolveApiBaseUrl(): string {
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }
  if (typeof window === "undefined") {
    return PRODUCTION_API_URL;
  }
  const host = window.location.hostname;
  // The hosted frontend talks to the hosted API; a local dev server talks
  // to the backend running on port 8000 of the same host.
  if (host.endsWith(".netlify.app")) {
    return PRODUCTION_API_URL;
  }
  return `http://${host}:8000`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;
  bodyText: string;

  constructor(message: string, status: number, bodyText: string) {
    super(message);
    this.status = status;
    this.bodyText = bodyText;
  }
}

/** Extract the human readable `detail` field from a FastAPI error body. */
export function extractDetail(bodyText: string): string | null {
  if (!bodyText) return null;
  try {
    const parsed = JSON.parse(bodyText);
    const detail = parsed?.detail;
    if (typeof detail === "string") return detail;
    // FastAPI validation errors: [{loc, msg, type}, ...]
    if (Array.isArray(detail) && detail.length > 0 && detail[0]?.msg) {
      return String(detail[0].msg);
    }
  } catch {
    // Not JSON - fall through and use the raw text.
    return bodyText.slice(0, 200);
  }
  return null;
}

/** Turn any thrown value into a message that is safe to show to the user. */
export function apiErrorMessage(err: unknown, fallback = "Request failed"): string {
  if (err instanceof ApiError) {
    return extractDetail(err.bodyText) ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

type RequestOptions = {
  auth?: boolean;
  headers?: Record<string, string>;
};

const SIGNOUT_REASON_KEY = "sfms_signout_reason";

export type SignOutReason =
  | "idle"
  | "expired"
  | "invalid_token"
  | "password_changed";

/**
 * Work out why an authenticated request was rejected, so the login screen can
 * explain it instead of always claiming an inactivity timeout.
 */
function resolveSignOutReason(bodyText: string): SignOutReason {
  if (bodyText.includes("Session expired")) return "expired";
  if (bodyText.includes("Invalid token") || bodyText.includes("User not found")) {
    return "invalid_token";
  }
  if (bodyText.includes("Not authenticated")) return "expired";
  return "idle";
}

function handleUnauthorized(
  options: RequestOptions | undefined,
  reason: SignOutReason = "idle",
) {
  // Only a request that actually carried a token can invalidate a session.
  // A 401 from a public endpoint (e.g. POST /auth/login with a wrong
  // password) must not sign the user out and must not navigate away,
  // otherwise the real error message is lost.
  if (!options?.auth) return;
  clearAccessToken();
  if (typeof window === "undefined" || window.location.pathname === "/login") {
    // Already on the login screen - let the caller render the error inline
    // instead of reloading the page (which would wipe it).
    return;
  }
  try {
    localStorage.setItem(SIGNOUT_REASON_KEY, reason);
  } catch {
    // ignore
  }
  window.location.href = "/login";
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  if (options.auth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(`Network error: ${msg}`, 0, "");
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    if (res.status === 401) {
      handleUnauthorized(options, resolveSignOutReason(bodyText));
    }
    throw new ApiError(`Request failed: ${res.status}`, res.status, bodyText);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  return (await res.text()) as unknown as T;
}

export async function apiFetchForm<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: form,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(`Network error: ${msg}`, 0, "");
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    if (res.status === 401) {
      handleUnauthorized({ auth: true }, resolveSignOutReason(bodyText));
    }
    throw new ApiError(`Request failed: ${res.status}`, res.status, bodyText);
  }

  return (await res.json()) as T;
}

export async function apiFetchBlob(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<Blob> {
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  if (options.auth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(`Network error: ${msg}`, 0, "");
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    if (res.status === 401) {
      handleUnauthorized(options, resolveSignOutReason(bodyText));
    }
    throw new ApiError(`Request failed: ${res.status}`, res.status, bodyText);
  }

  return await res.blob();
}
