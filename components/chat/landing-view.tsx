"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { RecentImages } from "@/components/images/recent-images";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { IMAGES_AGENT } from "@/lib/api/agents";
import { createThread } from "@/lib/api/threads";
import { useUiStore } from "@/stores/ui-store";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Composer } from "./composer/composer";
import { type ChatMode, ModeToggle } from "./mode-toggle";
import { runOptions } from "./use-thread";
import { WorkspaceBar } from "./workspace-bar";

const SUGGESTIONS = [
  "Summarize the latest board report",
  "Draft an email to the finance team",
  "What can the deep-research agent do?",
  "Explain our Q3 revenue drivers",
];

/**
 * Starts a conversation from a new-chat page: the first message creates the
 * thread over HTTP and starts its run, in the workspace bar's workspace, with
 * the composer's choices or the agent given (the Images page's); the thread
 * view then opens it, subscribes and replays the turn from its start.
 */
export function useStartChat(agentId?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (message: PromptInputMessage) => {
      if (!message.text.trim()) return;
      let threadId: string;
      try {
        const workspaceId = useUiStore.getState().newChatWorkspaceId ?? undefined;
        threadId = (await createThread(message.text, { ...runOptions(), ...(agentId && { agentId }), workspaceId }))
          .threadId;
      } catch (err) {
        setError((err as Error).message);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["threads"] }); // the sidebar shows it, in its workspace
      router.push(`/chat/${threadId}`);
    },
    [agentId, router, queryClient],
  );
  return { start, error };
}

const MODES = {
  chat: { title: "How can I help?", hint: "Choose a model or an agent, then ask anything." },
  images: {
    title: "Create an image",
    hint: "Describe it and pick an image model, then keep talking to change it.",
  },
} as const;

/**
 * The new-conversation page, /chat or /images: one composer whose mode the
 * toggle at the top switches (and the route with it). Chat picks the model, agent and
 * connectors and offers suggestions; Images picks the image model, shows the
 * latest images and starts a conversation with the images agent.
 */
export function LandingView({ mode = "chat" }: { mode?: ChatMode }) {
  // ?prompt= starts the composer with a draft, e.g. the skills page's
  // "Create with agent".
  const draft = useSearchParams().get("prompt") ?? undefined;
  const images = mode === "images";
  const { start, error } = useStartChat(images ? IMAGES_AGENT : undefined);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 px-4">
        <SidebarTrigger className="text-muted-foreground" />
        <ModeToggle mode={mode} />
      </header>

      {/* From the top, not centred: the heading stays put when a mode is taller. */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pt-[max(2rem,14vh)] pb-16">
        <div className="mb-10 text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight">{MODES[mode].title}</h1>
          <p className="mt-3 text-[15px] text-muted-foreground">{error ?? MODES[mode].hint}</p>
        </div>

        <div className="w-full">
          <Composer
            key={draft}
            autoFocus
            onSubmit={start}
            status="ready"
            initialText={draft}
            images={images}
            placeholder={images ? "Describe an image…" : undefined}
          />
          <WorkspaceBar />
        </div>

        {images ? (
          <RecentImages />
        ) : (
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
        )}
      </div>
    </div>
  );
}
