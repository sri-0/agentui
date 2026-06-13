/**
 * Direct-to-backend client for all NON-streaming APIs (agents, models, threads,
 * history). The chat stream is the only thing that goes through a Next proxy.
 *
 * The backend (adk-go) serves wide-open CORS, so the browser calls it directly.
 */

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // Only send Content-Type when there's a body. Adding it to GET requests makes
  // them "non-simple" and triggers a CORS preflight (OPTIONS) that the backend
  // doesn't handle (405) — which surfaces as a CORS error in the browser.
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text || `Request failed: ${res.status}`);
  }

  // Some endpoints (DELETE) may return empty bodies.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
