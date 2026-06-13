import type { Thread } from "./api/types";

export type ThreadGroup = { label: string; threads: Thread[] };

function toMs(t: Thread): number {
  const raw = t.updated_at ?? t.created_at;
  if (raw == null) return 0;
  if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const DAY = 86_400_000;

/** Bucket threads into Today / Yesterday / Previous 7 days / 30 days / Older. */
export function groupThreads(threads: Thread[], now = Date.now()): ThreadGroup[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const buckets: Record<string, Thread[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    "Previous 30 days": [],
    Older: [],
  };

  const sorted = [...threads].sort((a, b) => toMs(b) - toMs(a));
  for (const t of sorted) {
    const ms = toMs(t);
    if (ms >= todayMs) buckets.Today.push(t);
    else if (ms >= todayMs - DAY) buckets.Yesterday.push(t);
    else if (ms >= todayMs - 7 * DAY) buckets["Previous 7 days"].push(t);
    else if (ms >= todayMs - 30 * DAY) buckets["Previous 30 days"].push(t);
    else buckets.Older.push(t);
  }

  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, threads: list }));
}

export function threadTitle(t: Thread): string {
  const title = (t.title as string) || (t.name as string) || "";
  return title.trim() || "New chat";
}
