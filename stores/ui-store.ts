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
  /** the workspace a new conversation is filed under, or null for none */
  newChatWorkspaceId: string | null;
  /** the model generate_image uses, picked in an images composer; null for the server's default */
  selectedImageModel: string | null;
  /** the control set a new conversation is created under (C1000–C1020); null until one is picked */
  selectedControlSet: string | null;
  /** the open conversation's control set, fixed when it was created; "" while
   *  its record loads; null outside one */
  threadControlSet: string | null;

  setModel: (id: string | null) => void;
  setAgent: (id: string | null) => void;
  setConnectors: (ids: string[] | null) => void;
  openSidepanel: (s: NonNullable<SidepanelState>) => void;
  closeSidepanel: () => void;
  refreshArtifact: (id: string) => void;
  /** a fresh new-chat page, filed under the workspace given (none by default) */
  requestNewChat: (workspaceId?: string | null) => void;
  setLibraryView: (view: "grid" | "list") => void;
  setNewChatWorkspace: (id: string | null) => void;
  setImageModel: (id: string | null) => void;
  setControlSet: (id: string) => void;
  setThreadControlSet: (id: string | null) => void;
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
      newChatWorkspaceId: null,
      selectedImageModel: null,
      selectedControlSet: null,
      threadControlSet: null,

      setModel: (id) => set({ selectedModel: id }),
      setAgent: (id) => set({ selectedAgentId: id }),
      setConnectors: (ids) => set({ selectedConnectors: ids }),
      openSidepanel: (s) => set({ sidepanel: s }),
      closeSidepanel: () => set({ sidepanel: null }),
      refreshArtifact: (id) =>
        set((s) => ({ artifactRefresh: { ...s.artifactRefresh, [id]: (s.artifactRefresh[id] ?? 0) + 1 } })),
      requestNewChat: (workspaceId = null) =>
        set({ sidepanel: null, selectedConnectors: null, newChatWorkspaceId: workspaceId }),
      setLibraryView: (view) => set({ libraryView: view }),
      setNewChatWorkspace: (id) => set({ newChatWorkspaceId: id }),
      setImageModel: (id) => set({ selectedImageModel: id }),
      setControlSet: (id) => set({ selectedControlSet: id }),
      setThreadControlSet: (id) => set({ threadControlSet: id }),
    }),
    {
      name: "agentui-ui",
      // only persist durable preferences, not ephemeral panel/sidebar state
      partialize: (s) => ({
        selectedModel: s.selectedModel,
        selectedAgentId: s.selectedAgentId,
        libraryView: s.libraryView,
        selectedImageModel: s.selectedImageModel,
        selectedControlSet: s.selectedControlSet,
      }),
    },
  ),
);

/** The control set a POST creates documents under (X-Control-Set): the open
 *  conversation's, else the one picked for a new one; "" when nothing may be
 *  created yet. Runs carry none: the server takes a thread's from its record. */
export function currentControlSet() {
  const s = useUiStore.getState();
  return s.threadControlSet ?? s.selectedControlSet ?? undefined;
}
