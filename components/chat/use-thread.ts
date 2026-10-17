"use client";

import { useCallback, useEffect } from "react";

import { emptyThread } from "@/lib/chat/reduce";
import { cancelRun, closeThread, openThread, resumeRun, sendMessage, useChatStore } from "@/lib/chat/store";
import { useUiStore } from "@/stores/ui-store";

import type { QuestionAnswers } from "./messages/question-card";

/** The backend's plain-model agent, used when "No agent" is picked. */
const PLAIN_MODEL_AGENT = "chat";

/** "Auto" leaves the choice to the backend's default agent. */
function agentIdFor(selected: string | null): string | undefined {
  if (selected === null) return PLAIN_MODEL_AGENT;
  if (selected === "auto") return undefined;
  return selected;
}

/** What the composer's selectors currently ask for on a run. */
export function runOptions() {
  const { selectedAgentId, selectedModel, selectedConnectors } = useUiStore.getState();
  return { agentId: agentIdFor(selectedAgentId), model: selectedModel ?? undefined, connectors: selectedConnectors };
}

/**
 * A thread's messages and status, kept live over the socket while mounted,
 * plus the actions that drive it. Secondary views (a sub-agent's thread in the
 * side panel) call this with the child thread id and get the same model.
 */
export function useThread(threadId: string) {
  const thread = useChatStore((s) => s.threads[threadId]) ?? emptyThread;

  useEffect(() => {
    void openThread(threadId);
    return () => closeThread(threadId);
  }, [threadId]);

  const send = useCallback((text: string) => void sendMessage(threadId, text, runOptions()), [threadId]);
  const approve = useCallback(
    (interruptId: string, approved: boolean, justification?: string) =>
      void resumeRun(threadId, interruptId, { approved, justification }),
    [threadId],
  );
  const answer = useCallback(
    (interruptId: string, output: QuestionAnswers) => void resumeRun(threadId, interruptId, { output }),
    [threadId],
  );
  // Resolves once the server has stopped the run, so a turn can follow it.
  const stop = useCallback(() => cancelRun(threadId), [threadId]);

  return { ...thread, send, approve, answer, stop };
}
