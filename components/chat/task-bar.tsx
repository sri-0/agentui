"use client";

import { isTaskActive, isTaskSettled } from "@/lib/chat/tasks";
import type { ChatMessage, Task } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon,
  CircleIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";
import { memo } from "react";

/** The newest task-list snapshot in the thread. */
function latestTasks(messages: ChatMessage[]): Task[] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const part of messages[i].parts) {
      if (part.type === "data-task-list") {
        return Array.isArray(part.data.tasks) ? part.data.tasks : [];
      }
    }
  }
  return null;
}

/** Changes when a task is added or changes status, so the memoized bar skips
 *  per-token re-renders. `running` is folded in so the board hides once the
 *  run settles. */
function taskSignature(messages: ChatMessage[], running: boolean): string {
  const tasks = latestTasks(messages) ?? [];
  return `${tasks.map((t) => `${t.id}:${t.status}`).join(";")}|${running}`;
}

export const TaskBar = memo(
  function TaskBar({
    messages,
    running,
  }: {
    messages: ChatMessage[];
    /** Keep the board visible until the whole run settles. */
    running: boolean;
  }) {
    const tasks = latestTasks(messages);
    if (!tasks || tasks.length === 0) return null;

    const done = tasks.filter((t) => isTaskSettled(t.status)).length;
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
            return (
              <li
                key={t.id}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-sm"
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
