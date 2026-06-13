import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import { forwardHeaders } from "@/lib/chat/forward-headers";
import { pumpBackendSse } from "@/lib/chat/pump-backend-sse";
import { toBackendMessages } from "@/lib/chat/to-backend-messages";
import type { ChatMessage } from "@/lib/chat/types";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * THE proxy. Receives the useChat request, forwards to the adk-go backend's
 * OpenAI-compatible streaming endpoint (all headers passed through), and
 * converts its hybrid OpenAI/AG-UI SSE into an AI SDK UI-message stream.
 *
 * Every other API is called directly from the browser — this is the only proxy.
 */
export async function POST(req: Request) {
  const {
    messages = [],
    agentId,
    model,
    threadId,
    useRag,
    temporary,
    reasoningEffort,
  }: {
    messages: ChatMessage[];
    agentId?: string;
    model?: string;
    threadId?: string;
    useRag?: boolean;
    temporary?: boolean;
    reasoningEffort?: string;
  } = await req.json();

  const upstream = await fetch(`${BACKEND_URL}/v1/chat/completions`, {
    method: "POST",
    headers: forwardHeaders(req.headers),
    body: JSON.stringify({
      model: model ?? agentId,
      agent_id: agentId,
      messages: toBackendMessages(messages),
      stream: true,
      thread_id: temporary ? undefined : threadId,
      use_rag: Boolean(useRag),
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => upstream.statusText);
    return new Response(
      JSON.stringify({ error: `Backend error ${upstream.status}: ${detail}` }),
      { status: upstream.status || 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      await pumpBackendSse(upstream.body as ReadableStream<Uint8Array>, writer, {
        model,
        agentId,
      });
    },
    onError: (error) =>
      error instanceof Error ? error.message : "Stream error",
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "X-Accel-Buffering": "no" },
  });
}
