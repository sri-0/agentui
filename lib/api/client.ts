/**
 * Direct-to-backend client. The browser talks to the agentlite server itself:
 * REST through this helper, the agent stream through lib/chat/socket.ts.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text || `Request failed: ${res.status}`);
  }
  // DELETE returns an empty body.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** A response body as text, for content that is not JSON (artifact bodies). */
export async function apiText(path: string): Promise<string> {
  const res = await fetch(`${API_URL}${path}`);
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text || `Request failed: ${res.status}`);
  return text;
}
