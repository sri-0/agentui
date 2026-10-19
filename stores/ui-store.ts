import { create } from "zustand";
import { persist } from "zustand/middleware";

/** What the right-hand sidepanel is currently showing. */
export type SidepanelState =
  | { kind: "usage" }
  /** a sub-agent's own thread, live */
  | { kind: "agent"; threadId: string; name: string }
  | { kind: "agent-details"; agentId: string }
  | { kind: "connector"; connectorId: string }
  /** the conversation's artifacts, or one of them */
  | { kind: "artifacts" }
  | { kind: "artifact"; artifactId: string }
  /** the conversation's sources; `number` picks one out */
  | { kind: "sources"; number?: number }
  | { kind: "model"; modelId: string }
  | null;

type UiState = {
  selectedModel: string | null;
  /** an agent id, "auto" for the backend's default, or null for the bare model */
  selectedAgentId: string | null;
  /** connector ids switched on, or null for all of them */
  selectedConnectors: string[] | null;
  sidepanel: SidepanelState;
  /** Per url artifact id, bumped to reload its page: the panel's refresh
   *  button, or a tool that changed it (a slide deck write). */
  artifactRefresh: Record<string, number>;
  /** How the artifacts and skills pages lay out their items. */
  libraryView: "grid" | "list";

  setModel: (id: string | null) => void;
  setAgent: (id: string | null) => void;
  setConnectors: (ids: string[] | null) => void;
  openSidepanel: (s: NonNullable<SidepanelState>) => void;
  closeSidepanel: () => void;
  refreshArtifact: (id: string) => void;
  requestNewChat: () => void;
  setLibraryView: (view: "grid" | "list") => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedModel: null,
      selectedAgentId: "auto",
      selectedConnectors: null,
      sidepanel: null,
      artifactRefresh: {},
      libraryView: "grid",

      setModel: (id) => set({ selectedModel: id }),
      setAgent: (id) => set({ selectedAgentId: id }),
      setConnectors: (ids) => set({ selectedConnectors: ids }),
      openSidepanel: (s) => set({ sidepanel: s }),
      closeSidepanel: () => set({ sidepanel: null }),
      refreshArtifact: (id) =>
        set((s) => ({ artifactRefresh: { ...s.artifactRefresh, [id]: (s.artifactRefresh[id] ?? 0) + 1 } })),
      requestNewChat: () => set({ sidepanel: null, selectedConnectors: null }),
      setLibraryView: (view) => set({ libraryView: view }),
    }),
    {
      name: "agentui-ui",
      // only persist durable preferences, not ephemeral panel/sidebar state
      partialize: (s) => ({
        selectedModel: s.selectedModel,
        selectedAgentId: s.selectedAgentId,
        libraryView: s.libraryView,
      }),
    },
  ),
);
