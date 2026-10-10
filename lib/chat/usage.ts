import type { ChatMessage } from "./types";

/** Cheap client-side token estimate (~4 chars/token), used until the backend
 *  reports usage for a turn. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type Category = { label: string; tokens: number; color: string };

export type RichUsage = {
  exact: boolean;
  contextWindow: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  userMessages: number;
  assistantMessages: number;
  categories: Category[];
};

/**
 * Usage for the thread. Exact totals come from the latest assistant turn's
 * metadata (the backend reports them at RUN_FINISHED); the category breakdown
 * is estimated from the text so the bar always has something to show.
 */
export function deriveRichUsage(messages: ChatMessage[], contextWindow: number): RichUsage {
  let userTok = 0;
  let assistantTok = 0;
  let reasoningTok = 0;
  let toolTok = 0;
  let userMessages = 0;
  let assistantMessages = 0;

  for (const m of messages) {
    if (m.role === "user") userMessages++;
    else assistantMessages++;
    for (const p of m.parts) {
      if (p.type === "text") {
        const t = estimateTokens(p.text);
        if (m.role === "user") userTok += t;
        else assistantTok += t;
      } else if (p.type === "reasoning") {
        reasoningTok += estimateTokens(p.text);
      } else if (p.type === "tool") {
        const input = "input" in p ? JSON.stringify(p.input ?? "") : "";
        const output = "output" in p ? JSON.stringify(p.output ?? "") : "";
        toolTok += estimateTokens(input + output);
      }
    }
  }

  const reported = messages.findLast((m) => m.role === "assistant" && m.metadata?.usage)?.metadata?.usage;
  const inputTokens = reported?.inputTokens ?? userTok + toolTok;
  const outputTokens = reported?.outputTokens ?? assistantTok + reasoningTok;

  const categories: Category[] = [
    { label: "User", tokens: userTok, color: "bg-emerald-500" },
    { label: "Assistant", tokens: assistantTok, color: "bg-sky-500" },
    { label: "Reasoning", tokens: reasoningTok, color: "bg-violet-500" },
    { label: "Tool Calls", tokens: toolTok, color: "bg-amber-500" },
  ].filter((c) => c.tokens > 0);

  return {
    exact: Boolean(reported),
    contextWindow,
    totalTokens: inputTokens + outputTokens,
    inputTokens,
    outputTokens,
    reasoningTokens: reasoningTok,
    userMessages,
    assistantMessages,
    categories,
  };
}
