"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { createThread } from "@/lib/api/threads";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Composer } from "./composer/composer";
import { runOptions } from "./use-thread";

const SUGGESTIONS = [
  "Summarize the latest board report",
  "Draft an email to the finance team",
  "What can the deep-research agent do?",
  "Explain our Q3 revenue drivers",
];

export function LandingView() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  // The first message creates the thread over HTTP and starts its run; the
  // thread view then opens it, subscribes and replays the turn from its start.
  const start = async (message: PromptInputMessage) => {
    if (!message.text.trim()) return;
    let threadId: string;
    try {
      threadId = (await createThread(message.text, runOptions())).threadId;
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    router.push(`/chat/${threadId}`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center px-4">
        <SidebarTrigger className="text-muted-foreground" />
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="mb-10 text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            How can I help?
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground">
            {error ?? "Choose a model or an agent, then ask anything."}
          </p>
        </div>

        <div className="w-full">
          <Composer
            autoFocus
            onSubmit={start}
            status="ready"
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => start({ text: s, files: [] })}
              className="rounded-full border bg-card px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
