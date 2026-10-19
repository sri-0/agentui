/**
 * Direct-to-backend client. The browser talks to the agentlite server itself:
 * REST through this helper, the agent stream through lib/chat/socket.ts.
 */

import { currentControlSet } from "@/stores/ui-store";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
  // A POST creates documents under a control set: the conversation's, or the
  // picker's. Other requests need none (and a custom header would make the
  // browser preflight every one of them).
  const controlSet = currentControlSet();
  if (controlSet && init?.method?.toUpperCase() === "POST") headers.set("X-Control-Set", controlSet);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, serverMessage(text) || `Request failed: ${res.status}`);
  return text;
}

/** The server's own message in an error body ({"message": …}), or the body. */
function serverMessage(body: string) {
  try {
    return (JSON.parse(body) as { message?: string }).message ?? body;
  } catch {
    return body;
  }
}
