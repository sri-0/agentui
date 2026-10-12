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

export type Model = {
  id: string;
  object: "model";
  type: "llm" | "embedding" | "vision" | string;
  provider_id: string;
  provider_name: string;
  name?: string;
  description?: string;
  context_length?: number;
  vision?: boolean;
  tools?: boolean;
  reasoning?: boolean;
  audio?: boolean;
  multimodal?: boolean;
  owned_by?: string;
  capabilities?: string[];
  supported_parameters?: string[];
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
  created_at?: string | number;
  updated_at?: string | number;
  /** present while a run owns the thread */
  run_status?: RunStatus;
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
