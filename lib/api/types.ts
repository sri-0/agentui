import type { Event as AgUiEvent } from "@ag-ui/core";

/** Shapes returned by the agentlite backend. */

export type Agent = {
  id: string;
  name: string;
  description?: string;
  /** llm | sequential | parallel | loop | graph */
  kind: string;
  /** primary | subagent | all */
  mode: string;
  tools?: string[];
  /** ids of the agents this one dispatches or runs as stages */
  subagents?: string[];
  system_prompt?: string;
};

/** A model as /v1/models serves it: id "<provider>/<model>", the provider's
 *  own name for it, and what its provider, discovery and model card say. */
export type Model = {
  id: string;
  upstream_id: string;
  object: "model";
  type: "llm" | "embedding" | string;
  provider_id: string;
  provider_name: string;
  name?: string;
  description?: string;
  context_length?: number;
  max_output_tokens?: number;
  owned_by?: string;
  /** tool_calling, reasoning, vision, structured_output, … */
  capabilities?: string[];
  supported_parameters?: string[];
  /** US dollars per million tokens */
  pricing?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  benchmarks?: Record<string, number>;
  license?: string;
  release_date?: string;
  knowledge_cutoff?: string;
  /** the model card's notes (Markdown) */
  notes?: string;
  sources?: string[];
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
};

export type RunStatus = "queued" | "running" | "awaiting_input";

/** A tool group a thread can switch on (connectors.yaml). */
export type Connector = {
  id: string;
  name: string;
  description?: string;
  /** a lucide icon name */
  icon?: string;
  type: "tools" | "mcp";
  /** mcp: endpoint or command */
  url?: string;
  /** mcp: only on the detail endpoint, listed live from the server */
  tools?: { name: string; description?: string }[];
  /** mcp, detail endpoint only */
  status?: "ok" | "unreachable";
  error?: string;
};

export type Thread = {
  id: string;
  root_id: string;
  title?: string;
  agent_id?: string;
  model?: string;
  /** connectors switched on; absent means all */
  connectors?: string[];
  /** the workspace the conversation is filed under, if any */
  workspace_id?: string;
  /** the control set it was created under (C1000–C1020); fixed */
  controlset_id?: string;
  pinned?: boolean;
  /** left out of the sidebar */
  archived?: boolean;
  created_at?: string | number;
  updated_at?: string | number;
  /** present while a run owns the thread */
  run_status?: RunStatus;
    /** until when the backend can still pick the idle thread up */
  dormant_until?: string;
  /** readable, by its link, by everyone with access to its control set; else its creator's alone */
  is_shared: boolean;
  /** the user created it: they may change it and write in it; anyone else reads a public one */
  mine: boolean;
  /** the creator's username */
  user_created_by?: string;
};

/** A folder of conversations and files: public (everyone with access to its
 *  control set sees it and files under it) or its creator's alone. */
export type Workspace = {
  id: string;
  name: string;
  is_shared: boolean;
  /** the user created it: they may rename, share and delete it */
  mine: boolean;
  user_created_by?: string;
  created_at: string;
  updated_at: string;
};

/** One stored turn: the AG-UI events that produced it. */
export type StoredMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  seq: number;
  created_at: string;
  text: string;
  events: AgUiEvent[];
};

export type ListResponse<T> = { object: "list"; data: T[] };
