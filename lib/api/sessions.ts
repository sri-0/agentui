"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
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

/** Status of a single session (cheap polling / decide whether to attach). */
export function useSessionStatus(sessionId: string | null) {
  return useQuery({
    queryKey: ["session-status", sessionId],
    enabled: Boolean(sessionId),
    retry: false,
    queryFn: async () => {
      if (!sessionId) return null;
      try {
        return await apiFetch<SessionHandle>(
          `/v1/sessions/${encodeURIComponent(sessionId)}`,
        );
      } catch {
        return null;
      }
    },
  });
}
