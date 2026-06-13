import type { ChatRequestBody } from "./types";

/**
 * Hand-off store for the first message typed on the landing screen. We navigate
 * to /chat/[threadId] *before* streaming, so the thread page picks up the
 * pending prompt here and kicks off the request on mount.
 */
type Pending = {
  text: string;
  files?: { type: "file"; filename?: string; mediaType: string; url: string }[];
  body: ChatRequestBody;
};

const store = new Map<string, Pending>();

export function setPendingMessage(threadId: string, pending: Pending) {
  store.set(threadId, pending);
}

export function takePendingMessage(threadId: string): Pending | undefined {
  const p = store.get(threadId);
  store.delete(threadId);
  return p;
}
