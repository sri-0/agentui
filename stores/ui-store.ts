import { create } from "zustand";
import { persist } from "zustand/middleware";

/** What the right-hand sidepanel is currently showing. */
export type SidepanelState =
  | { kind: "usage" }
  /** a sub-agent's own thread, live */
  | { kind: "agent"; threadId: string; name: string }
  | { kind: "agent-details"; agentId: string }
  | { kind: "connector"; connectorId: string }
  | { kind: "artifact"; artifactId: string }
  | { kind: "model"; modelId: string }
  | null;

export type ReasoningEffort = "off" | "low" | "medium" | "high";

type UiState = {
  selectedModel: string | null;
  /** an agent id, "auto" for the backend's default, or null for the bare model */
  selectedAgentId: string | null;
  /** connector ids switched on, or null for all of them */
  selectedConnectors: string[] | null;
  reasoningEffort: ReasoningEffort;
  temporary: boolean;
  sidepanel: SidepanelState;
  sidebarOpen: boolean;
  /** bumped when "New chat" is clicked, so an in-place temp chat can reset */
  newChatNonce: number;

  setModel: (id: string | null) => void;
  setAgent: (id: string | null) => void;
  setConnectors: (ids: string[] | null) => void;
  setReasoningEffort: (e: ReasoningEffort) => void;
  setTemporary: (v: boolean) => void;
  openSidepanel: (s: NonNullable<SidepanelState>) => void;
  closeSidepanel: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
  requestNewChat: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedModel: null,
      selectedAgentId: "auto",
      selectedConnectors: null,
      reasoningEffort: "off",
      temporary: false,
      sidepanel: null,
      sidebarOpen: true,
      newChatNonce: 0,

      setModel: (id) => set({ selectedModel: id }),
      setAgent: (id) => set({ selectedAgentId: id }),
      setConnectors: (ids) => set({ selectedConnectors: ids }),
      setReasoningEffort: (e) => set({ reasoningEffort: e }),
      setTemporary: (v) => set({ temporary: v }),
      openSidepanel: (s) => set({ sidepanel: s }),
      closeSidepanel: () => set({ sidepanel: null }),
      toggleSidebar: () => set((st) => ({ sidebarOpen: !st.sidebarOpen })),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      requestNewChat: () =>
        set((st) => ({ newChatNonce: st.newChatNonce + 1, sidepanel: null })),
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
