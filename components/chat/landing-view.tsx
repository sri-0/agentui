"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { setPendingMessage } from "@/lib/chat/pending";
import { useUiStore } from "@/stores/ui-store";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Composer } from "./composer/composer";
import { TemporaryToggle } from "./temporary-toggle";
import { ThreadChat } from "./thread-view";

const noop = () => {};

const SUGGESTIONS = [
  "Summarize the latest board report",
  "Draft an email to the finance team",
  "What can the deep-research agent do?",
  "Explain our Q3 revenue drivers",
];

export function LandingView() {
  const router = useRouter();
  const selectedModel = useUiStore((s) => s.selectedModel);
  const selectedAgentId = useUiStore((s) => s.selectedAgentId);
  const reasoningEffort = useUiStore((s) => s.reasoningEffort);
  const temporary = useUiStore((s) => s.temporary);

  // A temporary chat runs in-place here (no route / no persistence). A normal
  // chat navigates to /chat/[id] so it's saved and shareable.
  const [tempThreadId, setTempThreadId] = useState<string | null>(null);
  const newChatNonce = useUiStore((s) => s.newChatNonce);
  useEffect(() => setTempThreadId(null), [newChatNonce]);

  const start = (message: PromptInputMessage) => {
    if (!message.text.trim() && (message.files?.length ?? 0) === 0) return;
    const threadId = nanoid();
    setPendingMessage(threadId, {
      text: message.text,
      files: message.files,
      body: {
        model: selectedModel ?? undefined,
        agentId: selectedAgentId ?? undefined,
        threadId: temporary ? undefined : threadId,
        temporary,
        useRag: (message.files?.length ?? 0) > 0,
        reasoningEffort: reasoningEffort === "off" ? undefined : reasoningEffort,
      },
    });
    if (temporary) {
      setTempThreadId(threadId);
    } else {
      router.push(`/chat/${threadId}`);
    }
  };

  if (tempThreadId) {
    return (
      <ThreadChat
        key={tempThreadId}
        threadId={tempThreadId}
        isTemporary
        initialMessages={[]}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center px-4">
        <SidebarTrigger className="text-muted-foreground" />
        <div className="ml-auto">
          <TemporaryToggle />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="mb-10 text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            How can I help?
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground">
            Choose a model or an agent, then ask anything.
          </p>
        </div>

        <div className="w-full">
          <Composer
            autoFocus
            onSubmit={start}
            status="ready"
            onStop={noop}
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
