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

/**
 * Attach/resume a server-side session's event stream. With `afterSeq` the
 * backend replays exactly-once from that sequence then continues live, so a
 * client that dropped mid-run rejoins gap-free (Phase 01). Returns the same v6
 * UI message stream, so it renders identically to the live run.
 */
export function sessionStreamUrl(sessionId: string, afterSeq = 0): string {
  return `${AGENTIC_URL}/v1/sessions/${encodeURIComponent(sessionId)}/stream?format=aisdk&after=${afterSeq}`;
}
