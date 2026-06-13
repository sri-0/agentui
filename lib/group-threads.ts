import dayjs from "./dayjs";
import type { Thread } from "./api/types";

export type ThreadGroup = { label: string; threads: Thread[] };

function toMs(t: Thread): number {
  const raw = t.updated_at ?? t.created_at;
  if (raw == null) return 0;
  // numeric unix seconds vs ms
  if (typeof raw === "number") {
    return raw < 1e12 ? dayjs.unix(raw).valueOf() : raw;
  }
  const d = dayjs(raw);
  return d.isValid() ? d.valueOf() : 0;
}

/** Bucket threads into Today / Yesterday / Previous 7 days / 30 days / Older. */
export function groupThreads(threads: Thread[], now?: number): ThreadGroup[] {
  const today = dayjs(now).startOf("day");
  const yesterday = today.subtract(1, "day").valueOf();
  const week = today.subtract(7, "day").valueOf();
  const month = today.subtract(30, "day").valueOf();
  const todayMs = today.valueOf();

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
    else if (ms >= yesterday) buckets.Yesterday.push(t);
    else if (ms >= week) buckets["Previous 7 days"].push(t);
    else if (ms >= month) buckets["Previous 30 days"].push(t);
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
