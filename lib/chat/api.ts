/**
 * Direct-to-Go endpoints for the chat stream. The Go backend emits the native
 * Vercel AI SDK v6 UI Message Stream when `?format=aisdk` is present, so the
 * browser talks to it directly — no Next translation proxy.
 */
export const AGENTIC_URL =
  process.env.NEXT_PUBLIC_AGENTIC_URL ?? "http://localhost:8011";

/** Streaming chat completion endpoint (native AI SDK v6 stream). */
export function chatUrl(): string {
  return `${AGENTIC_URL}/v1/chat/completions?format=aisdk`;
}

/** HITL resume endpoint — returns the same v6 stream. */
export function resumeUrl(): string {
  return `${AGENTIC_URL}/v1/agent/resume?format=aisdk`;
}
