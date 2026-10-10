/** Normalized lifecycle state of a task-list row. The `todowrite` tool passes
 *  the model's status strings through; collapse them to four phases. */
export type TaskPhase = "pending" | "active" | "done" | "cancelled";

export function normalizeTaskStatus(status: string): TaskPhase {
  switch (status) {
    case "in_progress":
    case "running":
      return "active";
    case "completed":
      return "done";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export function isTaskActive(status: string): boolean {
  return normalizeTaskStatus(status) === "active";
}

export function isTaskSettled(status: string): boolean {
  const p = normalizeTaskStatus(status);
  return p === "done" || p === "cancelled";
}
