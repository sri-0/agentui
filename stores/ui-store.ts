import { create } from "zustand";
import { persist } from "zustand/middleware";

/** What the right-hand sidepanel is currently showing. */
export type SidepanelState =
  | { kind: "usage" }
  | { kind: "agent"; agent: string; messageId: string }
  | { kind: "agent-details"; agentId: string; subAgent?: string }
  | { kind: "artifact"; artifactId: string }
  | { kind: "model"; modelId: string }
  | null;

export type ReasoningEffort = "off" | "low" | "medium" | "high";

type UiState = {
  selectedModel: string | null;
  selectedAgentId: string | null;
  reasoningEffort: ReasoningEffort;
  temporary: boolean;
  sidepanel: SidepanelState;
  sidebarOpen: boolean;
  /** bumped when "New chat" is clicked, so an in-place temp chat can reset */
  newChatNonce: number;
  /** Client-only set of question-interrupt toolCallIds the user has SKIPPED.
   *  A skipped question is hidden from the composer slot (the composer returns)
   *  but the backend run stays `awaiting-input` — no `denied` is posted — so the
   *  user can reopen it via the "Skipped Questions" button and still answer. */
  skippedQuestions: Set<string>;

  setModel: (id: string | null) => void;
  setAgent: (id: string | null) => void;
  setReasoningEffort: (e: ReasoningEffort) => void;
  setTemporary: (v: boolean) => void;
  openSidepanel: (s: NonNullable<SidepanelState>) => void;
  closeSidepanel: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
  requestNewChat: () => void;
  /** Locally skip a question interrupt (does NOT resolve the backend run). */
  skipQuestion: (toolCallId: string) => void;
  /** Un-skip → the question re-derives as active and reopens in the composer. */
  unskipQuestion: (toolCallId: string) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedModel: null,
      selectedAgentId: "auto",
      reasoningEffort: "off",
      temporary: false,
      sidepanel: null,
      sidebarOpen: true,
      newChatNonce: 0,
      skippedQuestions: new Set<string>(),

      setModel: (id) => set({ selectedModel: id }),
      setAgent: (id) => set({ selectedAgentId: id }),
      setReasoningEffort: (e) => set({ reasoningEffort: e }),
      setTemporary: (v) => set({ temporary: v }),
      openSidepanel: (s) => set({ sidepanel: s }),
      closeSidepanel: () => set({ sidepanel: null }),
      toggleSidebar: () => set((st) => ({ sidebarOpen: !st.sidebarOpen })),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      requestNewChat: () =>
        set((st) => ({ newChatNonce: st.newChatNonce + 1, sidepanel: null })),
      skipQuestion: (toolCallId) =>
        set((st) => {
          if (st.skippedQuestions.has(toolCallId)) return st;
          const next = new Set(st.skippedQuestions);
          next.add(toolCallId);
          return { skippedQuestions: next };
        }),
      unskipQuestion: (toolCallId) =>
        set((st) => {
          if (!st.skippedQuestions.has(toolCallId)) return st;
          const next = new Set(st.skippedQuestions);
          next.delete(toolCallId);
          return { skippedQuestions: next };
        }),
    }),
    {
      name: "agentui-ui",
      // Bumped to 1 so existing users (who have a persisted agent, or the old
      // `null` default) get migrated onto the new "auto" default and actually
      // SEE Auto selected. Only selectedAgentId is touched; other prefs pass
      // through untouched.
      version: 1,
      migrate: (persisted) => {
        const s = (persisted ?? {}) as {
          selectedModel?: string | null;
          reasoningEffort?: ReasoningEffort;
        };
        return {
          selectedModel: s.selectedModel ?? null,
          selectedAgentId: "auto",
          reasoningEffort: s.reasoningEffort ?? "off",
        };
      },
      // only persist durable preferences, not ephemeral panel/sidebar state
      partialize: (s) => ({
        selectedModel: s.selectedModel,
        selectedAgentId: s.selectedAgentId,
        reasoningEffort: s.reasoningEffort,
      }),
    },
  ),
);
