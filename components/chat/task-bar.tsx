"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/types";
import { useUiStore } from "@/stores/ui-store";
import {
  BotIcon,
  CheckCircle2Icon,
  CircleIcon,
  LoaderIcon,
} from "lucide-react";
import { memo } from "react";

/** The latest task-list part + the id of the message carrying it (so the owner
 *  chip can bind the side panel to that message's sub-agent stream). */
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
 *  re-renders but updates on real board changes. */
function taskSignature(messages: ChatMessage[]): string {
  const latest = latestTasks(messages);
  if (!latest) return "";
  let s = "";
  for (const t of latest.tasks) s += `${t.id}:${t.status}:${t.agent ?? ""};`;
  return s;
}

export const TaskBar = memo(
  function TaskBar({ messages }: { messages: ChatMessage[] }) {
    const openSidepanel = useUiStore((s) => s.openSidepanel);
    const latest = latestTasks(messages);
    if (!latest || latest.tasks.length === 0) return null;

    const { tasks, messageId } = latest;
    const done = tasks.filter((t) => t.status === "completed").length;
    if (done === tasks.length) return null;

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
                  "min-w-0 flex-1 truncate",
                  t.status === "completed" &&
                    "text-muted-foreground line-through",
                )}
              >
                {t.title}
              </span>
              {t.agent && (
                <button
                  type="button"
                  title={`Open ${t.agent}`}
                  onClick={() =>
                    openSidepanel({
                      kind: "agent",
                      agent: t.agent as string,
                      messageId,
                    })
                  }
                  className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <BotIcon className="size-3" />
                  <span className="max-w-[120px] truncate">{t.agent}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  },
  (a, b) => taskSignature(a.messages) === taskSignature(b.messages),
);
