import type { ThreadMessage } from "@/lib/api/types";

import type { ChatMessage } from "./types";

type Part = ChatMessage["parts"][number];

// re-exported for clarity: metadata footer type reconstructed on reload.

/** A loosely-typed persisted part as it arrives from the backend history JSON. */
type RawPart = {
  type?: unknown;
  id?: unknown;
  text?: unknown;
  data?: unknown;
  // dynamic-tool fields
  toolName?: unknown;
  toolCallId?: unknown;
  state?: unknown;
  input?: unknown;
  output?: unknown;
  errorText?: unknown;
  [key: string]: unknown;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

const asNumber = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/**
 * Rehydrate one persisted part into the AI-SDK part shape the UI renders.
 *
 * The backend persists parts using the SAME `type` names the live stream emits
 * (`text`, `reasoning`, `dynamic-tool`, `data-agent-step`, `data-agent-delta`,
 * `data-task-list`, `data-artifact`, `data-tool-interrupt`, …), so for the most
 * part this is a defensive normalization / pass-through: we keep the structural
 * fields `message-list.tsx` (and AgentCards / TaskBar / RunProgress / ToolCard)
 * read, coerce types, and drop anything malformed rather than throw.
 *
 * Returns `null` for parts we can't safely render (they're skipped, never
 * crash the reload).
 */
function rehydratePart(raw: unknown): Part | null {
  if (!isRecord(raw)) return null;
  const p = raw as RawPart;
  const type = asString(p.type);
  if (!type) return null;

  switch (type) {
    case "text":
      return { type: "text", text: asString(p.text) ?? "" } as Part;

    case "reasoning": {
      // Preserve the persisted thinking window (opencode model: unix-ms of the
      // first/last reasoning delta) so the collapse shows the REAL
      // "Thought for N seconds" on reload instead of a static label.
      const part: Record<string, unknown> = {
        type: "reasoning",
        text: asString(p.text) ?? "",
      };
      const startedMs = asNumber(p.startedMs);
      const endedMs = asNumber(p.endedMs);
      if (startedMs !== undefined) part.startedMs = startedMs;
      if (endedMs !== undefined) part.endedMs = endedMs;
      return part as Part;
    }

    case "dynamic-tool": {
      // Preserve the fields ToolCard reads: toolName / state / input / output /
      // toolCallId (+ errorText for error states). Default to a completed
      // "output-available" state when unspecified so the card renders settled.
      const toolName = asString(p.toolName);
      const toolCallId = asString(p.toolCallId);
      if (!toolName || !toolCallId) return null;
      return {
        type: "dynamic-tool",
        toolName,
        toolCallId,
        state: (asString(p.state) ?? "output-available") as never,
        input: p.input,
        output: p.output,
        ...(asString(p.errorText)
          ? { errorText: asString(p.errorText) }
          : {}),
      } as Part;
    }

    // Custom data parts. These carry a `data` payload (and, for the streaming
    // parts, an `id`) that the consumers key/aggregate on — preserve both.
    case "data-agent-step":
    case "data-agent-delta":
    case "data-agent-progress":
    case "data-task-list":
    case "data-artifact":
    case "data-tool-interrupt":
    case "data-usage": {
      if (!isRecord(p.data)) return null;
      const part: Record<string, unknown> = { type, data: p.data };
      const id = asString(p.id);
      if (id !== undefined) part.id = id;
      return part as Part;
    }

    default:
      // Unknown / future part types: pass through defensively if it looks like a
      // renderable AI-SDK part (has a `type` and either text or data), otherwise
      // skip. Never throw.
      if (asString(p.text) !== undefined || isRecord(p.data)) {
        return raw as Part;
      }
      return null;
  }
}

/**
 * Convert backend thread history into AI SDK UI messages.
 *
 * F3: full-parts rehydration. When a persisted (assistant) message carries a
 * structured `parts` array, reconstruct those parts so a reloaded message
 * renders identically to a live-streamed one (tool cards, reasoning collapsible,
 * agent cards, task bar, artifacts). Falls back to a single text part for
 * messages without `parts` (user messages / older text-only data).
 */
export function fromHistory(messages: ThreadMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, i) => {
      const id = (m.id as string) ?? `history-${i}`;
      const role = m.role as "user" | "assistant";

      // Rehydrate the per-message metadata footer (model · agent · duration) the
      // live `message-metadata` frame carried, persisted on the archive doc.
      const metadata = messageMetadata(m);

      const rawParts = (m as { parts?: unknown }).parts;
      if (Array.isArray(rawParts) && rawParts.length > 0) {
        const parts = rawParts
          .map(rehydratePart)
          .filter((p): p is Part => p !== null);
        // If nothing survived rehydration, fall back to the text mapping so the
        // bubble is never empty.
        if (parts.length > 0) {
          return metadata ? { id, role, parts, metadata } : { id, role, parts };
        }
      }

      const parts = [{ type: "text" as const, text: m.content ?? "" }];
      return metadata ? { id, role, parts, metadata } : { id, role, parts };
    });
}

/** Build the ChatMetadata footer from a persisted message's top-level fields. */
function messageMetadata(
  m: ThreadMessage
): ChatMessage["metadata"] | undefined {
  const model = asString(m.model);
  const agentId = asString((m as { agent_id?: unknown }).agent_id);
  const durationMs = asNumber((m as { duration_ms?: unknown }).duration_ms);
  if (model === undefined && agentId === undefined && durationMs === undefined) {
    return undefined;
  }
  const meta: NonNullable<ChatMessage["metadata"]> = {};
  if (model !== undefined) meta.model = model;
  if (agentId !== undefined) meta.agentId = agentId;
  if (durationMs !== undefined) meta.durationMs = durationMs;
  return meta;
}
