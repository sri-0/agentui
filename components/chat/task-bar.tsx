"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/types";
import { CheckCircle2Icon, CircleIcon, LoaderIcon } from "lucide-react";
import { memo } from "react";

function latestTasks(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const part of messages[i].parts) {
      if (part.type === "data-task-list") return part.data.tasks;
    }
  }
  return null;
}

/** Signature of the current task list — changes only when a task is added or its
 *  status changes, so memoized TaskBar skips per-token re-renders. */
function taskSignature(messages: ChatMessage[]): string {
  const tasks = latestTasks(messages);
  if (!tasks) return "";
  let s = "";
  for (const t of tasks) s += `${t.id}:${t.status};`;
  return s;
}

export const TaskBar = memo(
  function TaskBar({ messages }: { messages: ChatMessage[] }) {
    const tasks = latestTasks(messages);
    if (!tasks || tasks.length === 0) return null;

  const done = tasks.filter((t) => t.status === "completed").length;
  const allDone = done === tasks.length;
  if (allDone) return null;

  return (
    <div className="mx-auto mb-2 w-full max-w-3xl rounded-xl border bg-card/80 p-3 shadow-sm backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Tasks</span>
        <span className="text-xs text-muted-foreground">
          {done}/{tasks.length}
        </span>
      </div>
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            {t.status === "completed" ? (
              <CheckCircle2Icon className="size-4 shrink-0 text-green-600" />
            ) : t.status === "in_progress" ? (
              <LoaderIcon className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span
              className={cn(
                "truncate",
                t.status === "completed" && "text-muted-foreground line-through",
              )}
            >
              {t.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
  },
  (a, b) => taskSignature(a.messages) === taskSignature(b.messages),
);
