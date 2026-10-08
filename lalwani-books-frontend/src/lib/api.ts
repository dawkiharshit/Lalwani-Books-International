import { track } from "@/lib/loading-bus";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

/** Cache tag on every cached storefront read of the API (see /revalidate). */
export const API_TAG = "api";

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  cartToken?: string | null;
  revalidate?: number | false;
  cache?: RequestCache;
  /** Lets a caller cancel a request it no longer needs, e.g. search-as-you-type. */
  signal?: AbortSignal;
}

/**
 * Every request, server or browser. In the browser it is reported to the
 * loading bus, so a form's save shows the loading screen until it settles;
 * on the server that is a no-op.
 */
export function api<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  return track(request<T>(path, opts));
}

async function request<T>(path: string, opts: FetchOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts.cartToken) headers["X-Cart-Token"] = opts.cartToken;

  const init: RequestInit & { next?: { revalidate?: number | false } } = {
    method: opts.method || "GET",
    headers,
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  if (opts.signal) init.signal = opts.signal;
  if (opts.cache) init.cache = opts.cache;
  // Every cached API read carries the API_TAG, so /revalidate can expire all
  // of them at once the moment an admin saves.
  else if (opts.revalidate !== undefined) init.next = { revalidate: opts.revalidate, tags: [API_TAG] };

  const res = await fetch(`${API_BASE}${path}`, init);

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let errors: Record<string, string[]> | undefined;
    try {
      const data = await res.json();
      message = data.message || message;
      errors = data.errors;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, message, errors);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- client-side helpers (browser only) ---

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lalwani_token");
}

export function getCartToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem("lalwani_cart_token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("lalwani_cart_token", token);
  }
  return token;
}

export function clientApi<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  return api<T>(path, {
    cache: "no-store",
    ...opts,
    token: opts.token !== undefined ? opts.token : getAuthToken(),
    cartToken: opts.cartToken !== undefined ? opts.cartToken : getCartToken(),
  });
}

/** Multipart upload to an admin endpoint (FormData — browser sets the boundary). */
export function apiUpload<T>(path: string, formData: FormData, method: "POST" | "PUT" = "POST"): Promise<T> {
  return track(upload<T>(path, formData, method));
}

async function upload<T>(path: string, formData: FormData, method: "POST" | "PUT"): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData, cache: "no-store" });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    let errors: Record<string, string[]> | undefined;
    try {
      const data = await res.json();
      message = data.message || message;
      errors = data.errors;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, message, errors);
  }

  return res.json() as Promise<T>;
}
