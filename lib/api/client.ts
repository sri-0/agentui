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
  const text = await apiText(path, init);
  // DELETE returns an empty body.
  return (text ? JSON.parse(text) : undefined) as T;
}

/** A response body as text; apiFetch parses it as JSON, artifact bodies are
 *  used as they are. */
export async function apiText(path: string, init?: RequestInit): Promise<string> {
  const headers = new Headers(init?.headers);
  // JSON unless said otherwise; a FormData body gets its multipart type from the browser.
  if (typeof init?.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text || `Request failed: ${res.status}`);
  return text;
}
