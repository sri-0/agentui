"use client";

import { cn } from "@/lib/utils";
import {
  isTaskActive,
  isTaskSettled,
  taskAgentKey,
} from "@/lib/chat/tasks";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import {
  CheckCircle2Icon,
  CircleIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";
import { memo } from "react";

/** The latest task-list part + the id of the message carrying it (so the owner
 *  row can bind the side panel to that message's sub-agent stream). */
function latestTasks(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const part of messages[i].parts) {
      if (part.type === "data-task-list") {
        // Guard against a malformed/empty board (tasks can arrive null).
        const tasks = Array.isArray(part.data.tasks) ? part.data.tasks : [];
        return { tasks, messageId: messages[i].id };
      }
    }
  }
  return null;
}

/** Signature of the current task list — changes when a task is added, its status
 *  changes, or its owner is (re)assigned; so memoized TaskBar skips per-token
 *  re-renders but updates on real board changes. `running` is folded in so the
 *  board correctly appears/disappears when the coordinator run settles. */
function taskSignature(messages: ChatMessage[], running: boolean): string {
  const latest = latestTasks(messages);
  if (!latest) return `|${running}`;
  let s = "";
  for (const t of latest.tasks) s += `${t.id}:${t.status}:${t.agent ?? ""};`;
  return `${s}|${running}`;
}

export const TaskBar = memo(
  function TaskBar({
    messages,
    running,
  }: {
    messages: ChatMessage[];
    /** The parent coordinator run is still streaming/submitted. Keep the board
     *  visible until the whole run settles, not merely when child counts match. */
    running: boolean;
  }) {
    const openSidepanel = useUiStore((s) => s.openSidepanel);
    const latest = latestTasks(messages);
    if (!latest || latest.tasks.length === 0) return null;

    const { tasks, messageId } = latest;
    const done = tasks.filter((t) => isTaskSettled(t.status)).length;
    // Hide only once the coordinator run has fully settled AND every child is
    // done — while the parent keeps working the board must stay put.
    if (!running && done === tasks.length) return null;

    return (
      <div className="mx-auto mb-2 w-full max-w-3xl rounded-xl border bg-card/80 p-3 shadow-sm backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Tasks
          </span>
          <span className="text-xs text-muted-foreground">
            {done}/{tasks.length}
          </span>
        </div>
        <ul className="space-y-1">
          {tasks.map((t) => {
            const active = isTaskActive(t.status);
            const settled = isTaskSettled(t.status);
            const cancelled = t.status === "cancelled";
            const clickable = Boolean(t.agent);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  title={clickable ? `Open ${t.agent}` : undefined}
                  onClick={() =>
                    clickable &&
                    openSidepanel({
                      kind: "agent",
                      agent: taskAgentKey(t, messages),
                      messageId,
                    })
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors",
                    clickable
                      ? "cursor-pointer hover:bg-accent"
                      : "cursor-default",
                  )}
                >
                  {cancelled ? (
                    <XCircleIcon className="size-4 shrink-0 text-muted-foreground" />
                  ) : t.status === "completed" ? (
                    <CheckCircle2Icon className="size-4 shrink-0 text-green-600" />
                  ) : active ? (
                    <LoaderIcon className="size-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      settled && "text-muted-foreground",
                      t.status === "completed" && "line-through",
                    )}
                  >
                    {t.title}
                  </span>
                  {t.agent && (
                    <span className="max-w-[140px] shrink-0 truncate rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {t.agent}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
  (a, b) =>
    taskSignature(a.messages, a.running) === taskSignature(b.messages, b.running),
);
