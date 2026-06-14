"use client";

import { createContext, useContext } from "react";

/** Resolve a HITL tool interrupt and merge the streamed continuation back into
 *  the conversation. Provided by ThreadChat (which owns the useChat instance). */
export type ResolveInterrupt = (
  toolCallId: string,
  threadId: string,
  action: "approved" | "denied",
) => Promise<void>;

export const InterruptContext = createContext<ResolveInterrupt | null>(null);

export const useResolveInterrupt = () => useContext(InterruptContext);
