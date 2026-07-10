"use client";

import { createContext, useContext } from "react";

/** Extra payload carried by a `question`-tool resume: the selected option labels
 *  per question (`answers[i]` = labels chosen for question i) plus optional free
 *  text. Ignored by plain approve/deny (write_database) interrupts. */
export type InterruptAnswers = {
  answers?: string[][];
  text?: string;
};

/** Resolve a HITL tool interrupt and merge the streamed continuation back into
 *  the conversation. Provided by ThreadChat (which owns the useChat instance).
 *  `answers` is only set for the interactive `question` card; approve/deny cards
 *  omit it. */
export type ResolveInterrupt = (
  toolCallId: string,
  action: "approved" | "denied",
  answers?: InterruptAnswers,
) => Promise<void>;

export const InterruptContext = createContext<ResolveInterrupt | null>(null);

export const useResolveInterrupt = () => useContext(InterruptContext);
