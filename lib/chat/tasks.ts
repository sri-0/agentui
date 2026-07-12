import type { ChatDataParts, ChatMessage } from "@/lib/chat/types";

export type TaskItem = ChatDataParts["task-list"]["tasks"][number];
export type TaskStatus = TaskItem["status"];

/** Normalized lifecycle state for a swarm task/sub-agent. The backend emits
 *  `"running"` for in-progress children (task.go) while the todowrite tool uses
 *  `"in_progress"` — collapse both to a single "active" state so the UI shows the
 *  same loading/spinner treatment regardless of source. */
export type TaskPhase = "pending" | "active" | "done" | "cancelled";

export function normalizeTaskStatus(status: TaskStatus): TaskPhase {
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

/** True while a task is still being worked (spinner state). */
export function isTaskActive(status: TaskStatus): boolean {
  return normalizeTaskStatus(status) === "active";
}

/** True once a task has reached a terminal state (completed or cancelled). */
export function isTaskSettled(status: TaskStatus): boolean {
  const p = normalizeTaskStatus(status);
  return p === "done" || p === "cancelled";
}

/**
 * Resolve the sub-agent STREAM KEY (the `agent` label carried on
 * `data-agent-delta`/`data-agent-step` parts) for a swarm task row.
 *
 * Root cause of "clicking a task row opened an empty panel": the task list
 * (task.go) records `id = "<parentID>:<subagentType>-<short>"` and
 * `agent = "<subagentType>"` (the bare type), but every streamed part is keyed
 * by `label = "<subagentType>#<short>"`. The bare type never matches a delta's
 * agent, so the side panel bound to `t.agent` saw no parts.
 *
 * The `<short>` is a stable 8-char uuid prefix shared by both forms, so we
 * prefer to find the live delta/step agent whose `#<short>` suffix matches the
 * task id. Falling back to reconstructing `"<type>#<short>"` from the id keeps
 * the row clickable even before the first delta arrives.
 */
export function taskAgentKey(task: TaskItem, messages: ChatMessage[]): string {
  const short = childShort(task.id);
  if (short) {
    for (let i = messages.length - 1; i >= 0; i--) {
      for (const p of messages[i].parts) {
        if (
          (p.type === "data-agent-delta" ||
            p.type === "data-agent-step" ||
            p.type === "data-agent-progress") &&
          typeof p.data.agent === "string" &&
          p.data.agent.endsWith(`#${short}`)
        ) {
          return p.data.agent;
        }
      }
    }
    // No live part yet — reconstruct the label from the id + bare type.
    if (task.agent) return `${task.agent}#${short}`;
  }
  return task.agent ?? task.id;
}

/** The trailing 8-char short id shared by a child's session id and stream label,
 *  or "" if the id doesn't carry one. */
function childShort(id: string): string {
  const seg = id.slice(id.lastIndexOf(":") + 1); // "<type>-<short>"
  const dash = seg.lastIndexOf("-");
  if (dash === -1) return "";
  const short = seg.slice(dash + 1);
  return short.length >= 4 ? short : "";
}
