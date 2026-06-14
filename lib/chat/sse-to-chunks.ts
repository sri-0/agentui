import type { UIMessageChunk } from "ai";

/**
 * Parse an SSE response body (`data: {json}\n\n` frames) into a stream of AI SDK
 * UI-message chunks, so a fetched UI-message stream can be consumed client-side
 * via readUIMessageStream (used for the HITL resume continuation).
 */
export function sseToChunkStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<UIMessageChunk> {
  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            for (const line of rawEvent.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                controller.enqueue(JSON.parse(payload) as UIMessageChunk);
              } catch {
                /* ignore malformed chunk */
              }
            }
          }
        }
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}
