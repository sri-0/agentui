"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { createThread } from "@/lib/api/threads";
import { useUiStore } from "@/stores/ui-store";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Composer } from "./composer/composer";
import { runOptions } from "./use-thread";
import { WorkspaceBar } from "./workspace-bar";

const SUGGESTIONS = [
  "Summarize the latest board report",
  "Draft an email to the finance team",
  "What can the deep-research agent do?",
  "Explain our Q3 revenue drivers",
];

export function LandingView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // ?prompt= starts the composer with a draft, e.g. the skills page's
  // "Create with agent".
  const draft = useSearchParams().get("prompt") ?? undefined;

  const [error, setError] = useState<string | null>(null);

  // The first message creates the thread over HTTP and starts its run; the
  // thread view then opens it, subscribes and replays the turn from its start.
  const start = async (message: PromptInputMessage) => {
    if (!message.text.trim()) return;
    let threadId: string;
    try {
      const workspaceId = useUiStore.getState().newChatWorkspaceId ?? undefined;
      threadId = (await createThread(message.text, { ...runOptions(), workspaceId })).threadId;
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["threads"] }); // the sidebar shows it, in its workspace
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
            key={draft}
            autoFocus
            onSubmit={start}
            status="ready"
            initialText={draft}
          />
          <WorkspaceBar />
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
