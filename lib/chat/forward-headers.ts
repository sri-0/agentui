/**
 * Copy every inbound header through to the backend verbatim, dropping only
 * hop-by-hop headers that must not be forwarded. No auth special-casing.
 */
const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "accept-encoding",
]);

export function forwardHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  out.set("Content-Type", "application/json");
  out.set("Accept", "text/event-stream");
  return out;
}
