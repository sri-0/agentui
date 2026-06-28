/** Shapes returned by the adk-go backend. Kept loose where the backend emits maps. */

export type Agent = {
  id: string;
  name: string;
  /** agent type: basic | deep-research | triage | swarm | coordinator | … */
  type?: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  provider?: string;
  tools?: string[];
  sub_agents?: {
    id: string;
    name: string;
    description?: string;
    system_prompt?: string;
    model?: string;
    provider?: string;
    tools?: string[] | null;
  }[];
  keywords?: string[];
  max_iterations?: number;
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

export type Thread = {
  id: string;
  title?: string;
  created_at?: string | number;
  updated_at?: string | number;
  // backend may use different keys; keep index access tolerant
  [key: string]: unknown;
};

export type ThreadMessage = {
  id?: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  created_at?: string | number;
  [key: string]: unknown;
};

export type ListResponse<T> = { object: "list"; data: T[] };
