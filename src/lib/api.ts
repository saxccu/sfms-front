import { clearAccessToken, getAccessToken } from "./storage";

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  bodyText: string;

  constructor(message: string, status: number, bodyText: string) {
    super(message);
    this.status = status;
    this.bodyText = bodyText;
  }
}

type RequestOptions = {
  auth?: boolean;
  headers?: Record<string, string>;
};

const SIGNOUT_REASON_KEY = "sfms_signout_reason";

function handleUnauthorized(options: RequestOptions | undefined) {
  if (!options?.auth) return;
  try {
    localStorage.setItem(SIGNOUT_REASON_KEY, "idle");
  } catch {
    // ignore
  }
  clearAccessToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
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
      handleUnauthorized({ auth: true });
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
      handleUnauthorized({ auth: true });
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
      handleUnauthorized(options);
    }
    throw new ApiError(`Request failed: ${res.status}`, res.status, bodyText);
  }

  return await res.blob();
}
