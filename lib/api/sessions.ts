"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError, apiFetch } from "./client";
import type { ListResponse } from "./types";

/**
 * A server-side run (Phase 01). Runs execute in the background decoupled from the
 * connection, so a session can be `running` with no client attached; the UI uses
 * this to show still-running sessions and let the user rejoin them via
 * sessionStreamUrl(id, afterSeq).
 */
export interface SessionHandle {
  session_id: string;
  user_id: string;
  agent_id: string;
  status:
    | "queued"
    | "running"
    | "awaiting-input"
    | "done"
    | "error"
    | "cancelled";
  started_at: string;
  updated_at: string;
}

function unwrap<T>(res: ListResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : (res.data ?? []);
}

/**
 * Cancel a still-running server-side run. A run executes in the background,
 * decoupled from the client stream, so aborting the AI-SDK stream alone leaves
 * the server run executing (and the session `running`) indefinitely. The Stop
 * button MUST also hit this so the backend transitions `running → cancelled`.
 *
 * Best-effort / idempotent: a 404 means the run already settled (done/cancelled),
 * which is a no-op for us. `apiFetch` sends the X-User-ID identity header so the
 * cancel is scoped to the current user, matching the run's owner.
 */
export async function cancelSession(sessionId: string): Promise<void> {
  try {
    await apiFetch(`/v1/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: "POST",
    });
  } catch (err) {
    // Already settled (no active run) — nothing to cancel. Swallow so a Stop
    // click never surfaces an error for a race we don't care about.
    if (err instanceof ApiError && err.status === 404) return;
    throw err;
  }
}

/** List the user's runs (running + recently finished). */
export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    retry: false,
    refetchInterval: 5000, // surface live status changes
    queryFn: async () => {
      try {
        const res = await apiFetch<
          ListResponse<SessionHandle> | SessionHandle[]
        >("/v1/sessions");
        return unwrap(res);
      } catch {
        return [] as SessionHandle[];
      }
    },
  });
}

/**
 * Status of a single session (cheap polling / decide whether to attach).
 *
 * `enabled` lets the caller gate the probe: `GET /v1/sessions/{id}` returns 404
 * for a settled thread with no ACTIVE run, which the browser logs as a console
 * 404 on every load. Callers that already know a thread is settled (e.g. it's
 * absent from the user's live `/v1/sessions` list) should pass `enabled: false`
 * so we never fire the pointless request. A 404 still resolves to `null` (no
 * active session) rather than an app-level error, so a stale gate is harmless.
 */
export function useSessionStatus(
  sessionId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["session-status", sessionId],
    enabled: Boolean(sessionId) && enabled,
    retry: false,
    queryFn: async () => {
      if (!sessionId) return null;
      try {
        return await apiFetch<SessionHandle>(
          `/v1/sessions/${encodeURIComponent(sessionId)}`,
        );
      } catch (err) {
        // 404 = "no active run for this id" — the normal settled-thread case.
        // Resolve to null quietly; genuine errors also degrade to "nothing to
        // reconnect to" since there's nothing actionable for the UI to do.
        if (err instanceof ApiError && err.status === 404) return null;
        return null;
      }
    },
  });
}
