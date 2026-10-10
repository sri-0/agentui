"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { startThread } from "@/lib/chat/store";
import { useUiStore } from "@/stores/ui-store";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Composer } from "./composer/composer";
import { TemporaryToggle } from "./temporary-toggle";
import { ThreadChat } from "./thread-view";
import { runOptions } from "./use-thread";

const noop = () => {};

const SUGGESTIONS = [
  "Summarize the latest board report",
  "Draft an email to the finance team",
  "What can the deep-research agent do?",
  "Explain our Q3 revenue drivers",
];

export function LandingView() {
  const router = useRouter();
  const temporary = useUiStore((s) => s.temporary);

  // A temporary chat runs in place here (no route). A normal chat navigates to
  // /chat/[id] so it's shareable. "New chat" bumps the nonce, which retires an
  // in-place temporary chat.
  const newChatNonce = useUiStore((s) => s.newChatNonce);
  const [temp, setTemp] = useState<{ id: string; nonce: number } | null>(null);
  const tempThreadId = temp?.nonce === newChatNonce ? temp.id : null;

  const [error, setError] = useState<string | null>(null);

  // The first message starts the run and the server names the thread; the
  // thread view then opens it and replays the turn from its start.
  const start = async (message: PromptInputMessage) => {
    if (!message.text.trim()) return;
    let threadId: string;
    try {
      threadId = (await startThread(message.text, runOptions())).thread_id;
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    if (temporary) {
      setTemp({ id: threadId, nonce: newChatNonce });
    } else {
      router.push(`/chat/${threadId}`);
    }
  };

  if (tempThreadId) {
    return <ThreadChat key={tempThreadId} threadId={tempThreadId} isTemporary />;
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
            {error ?? "Choose a model or an agent, then ask anything."}
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
