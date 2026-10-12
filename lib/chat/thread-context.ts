"use client";

import { createContext, useContext } from "react";

/** The thread a view shows. Sources and artifacts are the conversation's, so
 *  a sub-agent's thread, shown inside its parent's view, uses the parent's. */
export const ThreadIdContext = createContext<string | null>(null);

export function useThreadId(): string {
  const id = useContext(ThreadIdContext);
  if (!id) throw new Error("useThreadId outside a thread view");
  return id;
}
