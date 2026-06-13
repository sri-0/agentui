import { create } from "zustand";
import { persist } from "zustand/middleware";

/** What the right-hand sidepanel is currently showing. */
export type SidepanelState =
  | { kind: "usage" }
  | { kind: "agent"; agent: string; messageId: string }
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

  setModel: (id: string | null) => void;
  setAgent: (id: string | null) => void;
  setReasoningEffort: (e: ReasoningEffort) => void;
  setTemporary: (v: boolean) => void;
  openSidepanel: (s: NonNullable<SidepanelState>) => void;
  closeSidepanel: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedModel: null,
      selectedAgentId: null,
      reasoningEffort: "off",
      temporary: false,
      sidepanel: null,
      sidebarOpen: true,

      setModel: (id) => set({ selectedModel: id }),
      setAgent: (id) => set({ selectedAgentId: id }),
      setReasoningEffort: (e) => set({ reasoningEffort: e }),
      setTemporary: (v) => set({ temporary: v }),
      openSidepanel: (s) => set({ sidepanel: s }),
      closeSidepanel: () => set({ sidepanel: null }),
      toggleSidebar: () => set((st) => ({ sidebarOpen: !st.sidebarOpen })),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
    }),
    {
      name: "agentui-ui",
      // only persist durable preferences, not ephemeral panel/sidebar state
      partialize: (s) => ({
        selectedModel: s.selectedModel,
        selectedAgentId: s.selectedAgentId,
        reasoningEffort: s.reasoningEffort,
      }),
    },
  ),
);
