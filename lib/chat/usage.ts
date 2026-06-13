import type { ChatMessage } from "./types";

/** Cheap client-side token estimate (~4 chars/token) used until the backend
 *  emits real usage. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type UsageInfo = {
  used: number;
  total: number;
  breakdown: { label: string; tokens: number }[];
  /** true when sourced from a backend usage event rather than estimated */
  exact: boolean;
};

/**
 * Derive context usage for a thread. Prefers the most recent `data-usage` part
 * (emitted by the backend); falls back to estimating from message text.
 */
export function deriveUsage(
  messages: ChatMessage[],
  contextWindow: number,
): UsageInfo {
  // most recent usage part wins
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const part of messages[i].parts) {
      if (part.type === "data-usage") {
        const d = part.data;
        return {
          used: d.contextUsed || d.totalTokens,
          total: d.contextWindow || contextWindow,
          breakdown:
            d.breakdown && d.breakdown.length
              ? d.breakdown
              : [
                  { label: "Prompt", tokens: d.promptTokens },
                  { label: "Completion", tokens: d.completionTokens },
                ],
          exact: true,
        };
      }
    }
  }

  // estimate
  let user = 0;
  let assistant = 0;
  for (const m of messages) {
    const text = m.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
    const t = estimateTokens(text);
    if (m.role === "user") user += t;
    else assistant += t;
  }
  return {
    used: user + assistant,
    total: contextWindow,
    breakdown: [
      { label: "User messages", tokens: user },
      { label: "Assistant messages", tokens: assistant },
    ],
    exact: false,
  };
}

export type Category = { label: string; tokens: number; color: string };

export type RichUsage = {
  exact: boolean;
  contextWindow: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheTokens: number;
  userMessages: number;
  assistantMessages: number;
  categories: Category[];
};

/** Full opencode-style usage breakdown, exact where the backend reports it. */
export function deriveRichUsage(
  messages: ChatMessage[],
  contextWindow: number,
): RichUsage {
  let userTok = 0;
  let assistantTok = 0;
  let reasoningTok = 0;
  let toolTok = 0;
  let userMessages = 0;
  let assistantMessages = 0;

  for (const m of messages) {
    if (m.role === "user") userMessages++;
    if (m.role === "assistant") assistantMessages++;
    for (const p of m.parts) {
      if (p.type === "text") {
        const t = estimateTokens(p.text);
        if (m.role === "user") userTok += t;
        else assistantTok += t;
      } else if (p.type === "reasoning") {
        reasoningTok += estimateTokens(p.text);
      } else if (p.type === "dynamic-tool") {
        const input = "input" in p ? JSON.stringify(p.input ?? "") : "";
        const output = "output" in p ? JSON.stringify(p.output ?? "") : "";
        toolTok += estimateTokens(input + output);
      } else if (p.type === "data-agent-delta") {
        assistantTok += estimateTokens(p.data.delta);
      }
    }
  }

  // exact totals from the most recent backend usage event, if present
  let exact = false;
  let inputTokens = userTok + toolTok;
  let outputTokens = assistantTok + reasoningTok;
  let totalTokens = inputTokens + outputTokens;
  for (let i = messages.length - 1; i >= 0 && !exact; i--) {
    for (const p of messages[i].parts) {
      if (p.type === "data-usage") {
        exact = true;
        inputTokens = p.data.promptTokens || inputTokens;
        outputTokens = p.data.completionTokens || outputTokens;
        totalTokens = p.data.totalTokens || totalTokens;
        if (p.data.contextWindow) contextWindow = p.data.contextWindow;
        break;
      }
    }
  }

  const categories: Category[] = [
    { label: "User", tokens: userTok, color: "bg-emerald-500" },
    { label: "Assistant", tokens: assistantTok, color: "bg-sky-500" },
    { label: "Reasoning", tokens: reasoningTok, color: "bg-violet-500" },
    { label: "Tool Calls", tokens: toolTok, color: "bg-amber-500" },
  ].filter((c) => c.tokens > 0);

  return {
    exact,
    contextWindow,
    totalTokens,
    inputTokens,
    outputTokens,
    reasoningTokens: reasoningTok,
    cacheTokens: 0,
    userMessages,
    assistantMessages,
    categories,
  };
}
