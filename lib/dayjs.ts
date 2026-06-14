import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";

// Configure dayjs once for the whole app. Import from here, never `dayjs`
// directly, so plugins are always available.
dayjs.extend(duration);
dayjs.extend(relativeTime);

/** Compact human duration: 450ms · 2.3s · 1m 5s. The single formatter used
 *  everywhere (message meta, sub-agent timing, …). */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const d = dayjs.duration(ms);
  if (ms < 60_000) return `${d.asSeconds().toFixed(1)}s`;
  return d.format("m[m] s[s]");
}

export default dayjs;
