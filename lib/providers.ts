/**
 * Map a model id (e.g. "openai/gpt-4o", "anthropic/claude-3.5", "gpt-oss-120b")
 * to a provider brand for display + icon. Icons live in /public/providers/*.svg.
 */
export type ProviderInfo = { key: string; name: string };

const FALLBACK: ProviderInfo = { key: "openrouter", name: "OpenRouter" };

// id-prefix (before the first "/") → provider
const PREFIX: Record<string, ProviderInfo> = {
  openai: { key: "openai", name: "OpenAI" },
  anthropic: { key: "anthropic", name: "Anthropic" },
  google: { key: "gemini", name: "Google" },
  "google-vertex": { key: "gemini", name: "Google" },
  "meta-llama": { key: "meta", name: "Meta" },
  meta: { key: "meta", name: "Meta" },
  mistralai: { key: "mistral", name: "Mistral" },
  mistral: { key: "mistral", name: "Mistral" },
  deepseek: { key: "deepseek", name: "DeepSeek" },
  qwen: { key: "qwen", name: "Qwen" },
  "x-ai": { key: "grok", name: "xAI" },
  xai: { key: "grok", name: "xAI" },
  cohere: { key: "cohere", name: "Cohere" },
  perplexity: { key: "perplexity", name: "Perplexity" },
  microsoft: { key: "microsoft", name: "Microsoft" },
  amazon: { key: "bedrock", name: "Amazon" },
  moonshotai: { key: "moonshot", name: "Moonshot" },
  moonshot: { key: "moonshot", name: "Moonshot" },
  "01-ai": { key: "yi", name: "01.AI" },
  nvidia: { key: "nvidia", name: "NVIDIA" },
  ai21: { key: "ai21", name: "AI21" },
  minimax: { key: "minimax", name: "MiniMax" },
  "z-ai": { key: "zhipu", name: "Zhipu" },
  zhipu: { key: "zhipu", name: "Zhipu" },
  openrouter: { key: "openrouter", name: "OpenRouter" },
};

// keyword fallback for slash-less ids (e.g. "gpt-oss-120b")
const KEYWORD: [RegExp, ProviderInfo][] = [
  [/gpt|o1|o3|o4|davinci/, { key: "openai", name: "OpenAI" }],
  [/claude/, { key: "anthropic", name: "Anthropic" }],
  [/gemini|gemma|palm/, { key: "gemini", name: "Google" }],
  [/llama/, { key: "meta", name: "Meta" }],
  [/mistral|mixtral|codestral/, { key: "mistral", name: "Mistral" }],
  [/deepseek/, { key: "deepseek", name: "DeepSeek" }],
  [/qwen/, { key: "qwen", name: "Qwen" }],
  [/grok/, { key: "grok", name: "xAI" }],
  [/command|cohere/, { key: "cohere", name: "Cohere" }],
  [/phi/, { key: "microsoft", name: "Microsoft" }],
  [/nova|titan/, { key: "bedrock", name: "Amazon" }],
  [/kimi|moonshot/, { key: "moonshot", name: "Moonshot" }],
];

export function providerForModel(modelId?: string): ProviderInfo {
  if (!modelId) return FALLBACK;
  const lower = modelId.toLowerCase();
  const prefix = lower.split("/")[0];
  if (PREFIX[prefix]) return PREFIX[prefix];
  for (const [re, info] of KEYWORD) {
    if (re.test(lower)) return info;
  }
  return FALLBACK;
}
