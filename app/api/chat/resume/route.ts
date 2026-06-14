import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import { forwardHeaders } from "@/lib/chat/forward-headers";
import { pumpBackendSse } from "@/lib/chat/pump-backend-sse";
import type { ChatMessage } from "@/lib/chat/types";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * HITL resume proxy. Forwards an approve/deny decision to the backend's
 * `/v1/agent/resume`, which streams the continuation (tool result + final
 * answer), and converts it to an AI SDK UI-message stream — so the client can
 * merge it back into the interrupted assistant turn.
 */
export async function POST(req: Request) {
  const {
    threadId,
    action,
    model,
    agentId,
  }: {
    threadId?: string;
    action?: "approved" | "denied";
    model?: string;
    agentId?: string;
  } = await req.json();

  const upstream = await fetch(`${BACKEND_URL}/v1/agent/resume`, {
    method: "POST",
    headers: forwardHeaders(req.headers),
    body: JSON.stringify({ thread_id: threadId, action: action ?? "denied" }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => upstream.statusText);
    return new Response(
      JSON.stringify({ error: `Backend error ${upstream.status}: ${detail}` }),
      {
        status: upstream.status || 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      await pumpBackendSse(upstream.body as ReadableStream<Uint8Array>, writer, {
        model,
        agentId,
      });
    },
    onError: (error) => (error instanceof Error ? error.message : "Stream error"),
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "X-Accel-Buffering": "no" },
  });
}
