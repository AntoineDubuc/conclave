/**
 * Comprehensive Models Configuration
 *
 * Central source of truth for all supported AI models across providers.
 * Used by model selection UI, pricing estimates, and execution.
 *
 * Source: docs/poc/MODELS_AND_PRICING.md
 * Updated: January 2026
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Provider identifiers - expanded to include open source providers via OpenRouter
 */
export type ProviderId =
  // Premium (Direct API)
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  // Open Source (via OpenRouter)
  | "deepseek"
  | "meta"
  | "mistral"
  | "qwen"
  // Other (via OpenRouter)
  | "microsoft"
  | "nvidia";

/**
 * Model pricing/access tier
 */
export type ModelTier = "premium" | "open-source" | "free";

export interface ModelInfo {
  id: string;           // API model ID (e.g., "claude-opus-4-5-20251101")
  name: string;         // Display name (e.g., "Claude Opus 4.5")
  provider: ProviderId;
  inputPrice: number;   // $ per million tokens
  outputPrice: number;  // $ per million tokens
  contextWindow: number;
  maxOutput: number;
  isBest?: boolean;     // Best/recommended model for this provider
  isLegacy?: boolean;   // Legacy model (still supported)
  description?: string; // Brief description
  // New tier-related fields
  tier?: ModelTier;     // Pricing/access tier (defaults to "premium" for backward compat)
  viaOpenRouter?: boolean;  // Whether this model is accessed through OpenRouter
  openRouterId?: string;    // OpenRouter model identifier (e.g., "deepseek/deepseek-r1")
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;         // Display name (e.g., "Anthropic")
  color: string;        // Brand color for UI
  envKey: string;       // Environment variable name for API key
  // New tier-related fields
  tier?: ModelTier;           // Provider's primary tier (defaults to "premium")
  requiresOpenRouter?: boolean;  // Whether this provider requires OpenRouter routing
}

// =============================================================================
// Tier Groupings
// =============================================================================

/** Premium providers with direct API access */
export const PREMIUM_PROVIDERS: ProviderId[] = ["anthropic", "openai", "google", "xai"];

/** Open source providers accessed via OpenRouter */
export const OPEN_SOURCE_PROVIDERS: ProviderId[] = ["deepseek", "meta", "mistral", "qwen"];

/** Other providers accessed via OpenRouter */
export const OTHER_PROVIDERS: ProviderId[] = ["microsoft", "nvidia"];

/** All providers that require OpenRouter routing */
export const OPENROUTER_PROVIDERS: ProviderId[] = [
  ...OPEN_SOURCE_PROVIDERS,
  ...OTHER_PROVIDERS,
];

/** All tiered providers (for new UI) */
export const TIERED_PROVIDER_LIST: ProviderId[] = [
  ...PREMIUM_PROVIDERS,
  ...OPEN_SOURCE_PROVIDERS,
  ...OTHER_PROVIDERS,
];

/** Model IDs for free tier models */
export const FREE_MODEL_IDS: string[] = [
  "deepseek-r1-free",
  "nemotron-30b-free",
];

// =============================================================================
// Providers
// =============================================================================

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  // Premium Providers (Direct API)
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    color: "#f97316", // Orange
    envKey: "ANTHROPIC_API_KEY",
    tier: "premium",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    color: "#22c55e", // Green
    envKey: "OPENAI_API_KEY",
    tier: "premium",
  },
  google: {
    id: "google",
    name: "Google",
    color: "#3b82f6", // Blue
    envKey: "GEMINI_API_KEY",
    tier: "premium",
  },
  xai: {
    id: "xai",
    name: "xAI",
    color: "#a855f7", // Purple
    envKey: "XAI_API_KEY",
    tier: "premium",
  },
  // Open Source Providers (via OpenRouter)
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    color: "#4a90d9", // Blue
    envKey: "OPENROUTER_API_KEY",
    tier: "open-source",
    requiresOpenRouter: true,
  },
  meta: {
    id: "meta",
    name: "Meta",
    color: "#0668e1", // Meta blue
    envKey: "OPENROUTER_API_KEY",
    tier: "open-source",
    requiresOpenRouter: true,
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    color: "#ff7000", // Orange
    envKey: "OPENROUTER_API_KEY",
    tier: "open-source",
    requiresOpenRouter: true,
  },
  qwen: {
    id: "qwen",
    name: "Qwen",
    color: "#6366f1", // Indigo
    envKey: "OPENROUTER_API_KEY",
    tier: "open-source",
    requiresOpenRouter: true,
  },
  // Other Providers (via OpenRouter)
  microsoft: {
    id: "microsoft",
    name: "Microsoft",
    color: "#00a4ef", // Microsoft blue
    envKey: "OPENROUTER_API_KEY",
    tier: "open-source",
    requiresOpenRouter: true,
  },
  nvidia: {
    id: "nvidia",
    name: "NVIDIA",
    color: "#76b900", // NVIDIA green
    envKey: "OPENROUTER_API_KEY",
    tier: "open-source",
    requiresOpenRouter: true,
  },
};

export const PROVIDER_LIST: ProviderId[] = ["anthropic", "openai", "google", "xai"];

// =============================================================================
// Models by Provider
// =============================================================================

export const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    inputPrice: 5.0,
    outputPrice: 25.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
    isBest: true,
    description: "Newest flagship, most capable",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    inputPrice: 3.0,
    outputPrice: 15.0,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    description: "Best for agentic workflows",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    inputPrice: 1.0,
    outputPrice: 5.0,
    contextWindow: 200_000,
    maxOutput: 64_000,
    description: "Fastest, most affordable",
  },
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    inputPrice: 5.0,
    outputPrice: 25.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
    isLegacy: true,
    description: "Frontier reasoning",
  },
  {
    id: "claude-opus-4-20250514",
    name: "Claude Opus 4",
    provider: "anthropic",
    inputPrice: 15.0,
    outputPrice: 75.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
    isLegacy: true,
    description: "Previous best coding model",
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    inputPrice: 3.0,
    outputPrice: 15.0,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    isLegacy: true,
    description: "SWE-bench 72.7%",
  },
];

export const OPENAI_MODELS: ModelInfo[] = [
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    inputPrice: 1.75,
    outputPrice: 14.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    isBest: true,
    description: "Flagship reasoning model",
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    provider: "openai",
    inputPrice: 1.25,
    outputPrice: 10.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    description: "Flagship for coding/agentic",
  },
  {
    id: "gpt-5",
    name: "GPT-5",
    provider: "openai",
    inputPrice: 1.25,
    outputPrice: 10.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    description: "Step-by-step reasoning",
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    inputPrice: 0.25,
    outputPrice: 2.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    description: "Compact, fast",
  },
  {
    id: "gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    inputPrice: 0.05,
    outputPrice: 0.4,
    contextWindow: 400_000,
    maxOutput: 128_000,
    description: "Most affordable",
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    inputPrice: 2.0,
    outputPrice: 8.0,
    contextWindow: 1_000_000,
    maxOutput: 32_000,
    description: "1M context window",
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    inputPrice: 0.4,
    outputPrice: 1.6,
    contextWindow: 1_000_000,
    maxOutput: 32_000,
    description: "Fast, 1M context",
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    inputPrice: 0.1,
    outputPrice: 0.4,
    contextWindow: 1_000_000,
    maxOutput: 32_000,
    description: "Budget, 1M context",
  },
  {
    id: "o3",
    name: "o3 (Reasoning)",
    provider: "openai",
    inputPrice: 2.0,
    outputPrice: 8.0,
    contextWindow: 200_000,
    maxOutput: 100_000,
    description: "Advanced reasoning",
  },
  {
    id: "o4-mini",
    name: "o4-mini (Reasoning)",
    provider: "openai",
    inputPrice: 1.1,
    outputPrice: 4.4,
    contextWindow: 200_000,
    maxOutput: 100_000,
    description: "Compact reasoning",
  },
];

export const GOOGLE_MODELS: ModelInfo[] = [
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "google",
    inputPrice: 2.0,
    outputPrice: 15.0,
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    isBest: true,
    description: "Best multimodal understanding",
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "google",
    inputPrice: 0.5,
    outputPrice: 4.0,
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    description: "Fast frontier intelligence",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    inputPrice: 1.25,
    outputPrice: 10.0,
    contextWindow: 1_000_000,
    maxOutput: 65_000,
    description: "Advanced reasoning",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    inputPrice: 0.3,
    outputPrice: 2.5,
    contextWindow: 1_000_000,
    maxOutput: 65_000,
    description: "Fast with reasoning",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    provider: "google",
    inputPrice: 0.1,
    outputPrice: 0.4,
    contextWindow: 1_000_000,
    maxOutput: 65_000,
    description: "Most affordable",
  },
];

export const XAI_MODELS: ModelInfo[] = [
  {
    id: "grok-3",
    name: "Grok 3",
    provider: "xai",
    inputPrice: 3.0,
    outputPrice: 15.0,
    contextWindow: 131_072,
    maxOutput: 32_000,
    isBest: true,
    description: "Latest flagship",
  },
  {
    id: "grok-3-fast",
    name: "Grok 3 Fast",
    provider: "xai",
    inputPrice: 0.6,
    outputPrice: 4.0,
    contextWindow: 131_072,
    maxOutput: 32_000,
    description: "Fast inference",
  },
  {
    id: "grok-3-mini",
    name: "Grok 3 Mini",
    provider: "xai",
    inputPrice: 0.3,
    outputPrice: 0.5,
    contextWindow: 131_072,
    maxOutput: 32_000,
    description: "Lightweight, thinks before responding",
  },
  {
    id: "grok-3-mini-fast",
    name: "Grok 3 Mini Fast",
    provider: "xai",
    inputPrice: 0.1,
    outputPrice: 0.4,
    contextWindow: 131_072,
    maxOutput: 32_000,
    description: "Fastest option",
  },
];

// =============================================================================
// Open Source Provider Models (via OpenRouter)
// =============================================================================

export const DEEPSEEK_MODELS: ModelInfo[] = [
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "deepseek",
    inputPrice: 0.70,
    outputPrice: 2.50,
    contextWindow: 163_000,
    maxOutput: 65_000,
    isBest: true,
    description: "MIT licensed reasoning model with visible thinking",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "deepseek/deepseek-r1",
  },
  {
    id: "deepseek-chat-v3",
    name: "DeepSeek Chat V3",
    provider: "deepseek",
    inputPrice: 0.19,
    outputPrice: 0.87,
    contextWindow: 163_000,
    maxOutput: 65_000,
    description: "685B MoE, competitive with GPT-4",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "deepseek/deepseek-chat",
  },
  {
    id: "deepseek-r1-free",
    name: "DeepSeek R1 Free",
    provider: "deepseek",
    inputPrice: 0,
    outputPrice: 0,
    contextWindow: 163_000,
    maxOutput: 65_000,
    description: "Free tier, rate limited (20 req/min)",
    tier: "free",
    viaOpenRouter: true,
    openRouterId: "deepseek/deepseek-r1-0528:free",
  },
];

export const META_MODELS: ModelInfo[] = [
  {
    id: "llama-4-scout",
    name: "Llama 4 Scout",
    provider: "meta",
    inputPrice: 0.08,
    outputPrice: 0.30,
    contextWindow: 327_000,
    maxOutput: 16_000,
    isBest: true,
    description: "109B MoE, multimodal with huge context",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "meta-llama/llama-4-scout",
  },
  {
    id: "llama-4-maverick",
    name: "Llama 4 Maverick",
    provider: "meta",
    inputPrice: 0.15,
    outputPrice: 0.60,
    contextWindow: 1_000_000,
    maxOutput: 16_000,
    description: "400B MoE, 1M context window",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "meta-llama/llama-4-maverick",
  },
];

export const MISTRAL_MODELS: ModelInfo[] = [
  {
    id: "mistral-large-2411",
    name: "Mistral Large 2411",
    provider: "mistral",
    inputPrice: 2.00,
    outputPrice: 6.00,
    contextWindow: 128_000,
    maxOutput: 8_192,
    isBest: true,
    description: "123B, strong long context understanding",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "mistralai/mistral-large-2411",
  },
  {
    id: "mistral-small-3.1-24b",
    name: "Mistral Small 3.1 24B",
    provider: "mistral",
    inputPrice: 0.03,
    outputPrice: 0.11,
    contextWindow: 128_000,
    maxOutput: 8_192,
    description: "Cheapest with vision support",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "mistralai/mistral-small-3.1-24b-instruct",
  },
  {
    id: "codestral-2508",
    name: "Codestral 2508",
    provider: "mistral",
    inputPrice: 0.30,
    outputPrice: 0.90,
    contextWindow: 256_000,
    maxOutput: 8_192,
    description: "Code specialist with fill-in-middle",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "mistralai/codestral-2508",
  },
];

export const QWEN_MODELS: ModelInfo[] = [
  {
    id: "qwen3-235b-a22b",
    name: "Qwen3 235B A22B",
    provider: "qwen",
    inputPrice: 0.20,
    outputPrice: 0.60,
    contextWindow: 131_000,
    maxOutput: 8_192,
    isBest: true,
    description: "MoE reasoning model",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "qwen/qwen3-235b-a22b",
  },
  {
    id: "qwen3-32b",
    name: "Qwen3 32B",
    provider: "qwen",
    inputPrice: 0.08,
    outputPrice: 0.24,
    contextWindow: 131_000,
    maxOutput: 8_192,
    description: "Extended thinking with <think> tags",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "qwen/qwen3-32b",
  },
  {
    id: "qwq-32b",
    name: "QwQ 32B",
    provider: "qwen",
    inputPrice: 0.15,
    outputPrice: 0.40,
    contextWindow: 131_000,
    maxOutput: 8_192,
    description: "Reasoning-focused model",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "qwen/qwq-32b",
  },
];

export const MICROSOFT_MODELS: ModelInfo[] = [
  {
    id: "phi-4",
    name: "Microsoft Phi-4",
    provider: "microsoft",
    inputPrice: 0.06,
    outputPrice: 0.14,
    contextWindow: 16_000,
    maxOutput: 4_096,
    isBest: true,
    description: "Compact 14B model, great value",
    tier: "open-source",
    viaOpenRouter: true,
    openRouterId: "microsoft/phi-4",
  },
];

export const NVIDIA_MODELS: ModelInfo[] = [
  {
    id: "nemotron-30b-free",
    name: "NVIDIA Nemotron 30B",
    provider: "nvidia",
    inputPrice: 0,
    outputPrice: 0,
    contextWindow: 131_000,
    maxOutput: 4_096,
    isBest: true,
    description: "Free tier, 30B MoE",
    tier: "free",
    viaOpenRouter: true,
    openRouterId: "nvidia/nemotron-3-nano-30b-a3b:free",
  },
];

// =============================================================================
// Combined Data
// =============================================================================

export const MODELS_BY_PROVIDER: Record<ProviderId, ModelInfo[]> = {
  // Premium providers
  anthropic: ANTHROPIC_MODELS,
  openai: OPENAI_MODELS,
  google: GOOGLE_MODELS,
  xai: XAI_MODELS,
  // Open source providers (via OpenRouter)
  deepseek: DEEPSEEK_MODELS,
  meta: META_MODELS,
  mistral: MISTRAL_MODELS,
  qwen: QWEN_MODELS,
  // Other providers (via OpenRouter)
  microsoft: MICROSOFT_MODELS,
  nvidia: NVIDIA_MODELS,
};

export const ALL_MODELS: ModelInfo[] = [
  ...ANTHROPIC_MODELS,
  ...OPENAI_MODELS,
  ...GOOGLE_MODELS,
  ...XAI_MODELS,
  ...DEEPSEEK_MODELS,
  ...META_MODELS,
  ...MISTRAL_MODELS,
  ...QWEN_MODELS,
  ...MICROSOFT_MODELS,
  ...NVIDIA_MODELS,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the best (recommended) model for a provider
 */
export function getBestModel(providerId: ProviderId): ModelInfo | undefined {
  return MODELS_BY_PROVIDER[providerId]?.find((m) => m.isBest);
}

/**
 * Get the default model for a provider (best non-legacy, or first available)
 */
export function getDefaultModel(providerId: ProviderId): ModelInfo | undefined {
  const models = MODELS_BY_PROVIDER[providerId];
  if (!models?.length) return undefined;

  // Return best model, or first non-legacy, or first available
  return (
    models.find((m) => m.isBest) ||
    models.find((m) => !m.isLegacy) ||
    models[0]
  );
}

/**
 * Get a model by its ID
 */
export function getModelById(modelId: string): ModelInfo | undefined {
  return ALL_MODELS.find((m) => m.id === modelId);
}

/**
 * Get all models for a provider (optionally excluding legacy)
 */
export function getModelsForProvider(
  providerId: ProviderId,
  includeLegacy: boolean = true
): ModelInfo[] {
  const models = MODELS_BY_PROVIDER[providerId] || [];
  return includeLegacy ? models : models.filter((m) => !m.isLegacy);
}

/**
 * Format price for display (e.g., "$3.00")
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Format price pair for display (e.g., "$3.00 / $15.00")
 */
export function formatPricePair(inputPrice: number, outputPrice: number): string {
  return `${formatPrice(inputPrice)} / ${formatPrice(outputPrice)}`;
}

/**
 * Get provider info by ID
 */
export function getProvider(providerId: ProviderId): ProviderInfo {
  return PROVIDERS[providerId];
}

// =============================================================================
// Tier Helper Functions
// =============================================================================

/**
 * Get the tier for a model (defaults to "premium" for backward compatibility)
 */
export function getModelTier(model: ModelInfo): ModelTier {
  return model.tier || "premium";
}

/**
 * Get the tier for a provider (defaults to "premium" for backward compatibility)
 */
export function getProviderTier(providerId: ProviderId): ModelTier {
  return PROVIDERS[providerId]?.tier || "premium";
}

/**
 * Check if a model requires OpenRouter routing
 */
export function isOpenRouterModel(model: ModelInfo): boolean {
  return model.viaOpenRouter === true;
}

/**
 * Check if a provider requires OpenRouter routing
 */
export function isOpenRouterProvider(providerId: ProviderId): boolean {
  return PROVIDERS[providerId]?.requiresOpenRouter === true;
}

/**
 * Check if a model is in the free tier
 */
export function isFreeModel(model: ModelInfo): boolean {
  return model.tier === "free" || FREE_MODEL_IDS.includes(model.id);
}

/**
 * Get all models for a specific tier
 */
export function getModelsByTier(tier: ModelTier): ModelInfo[] {
  return ALL_MODELS.filter((m) => getModelTier(m) === tier);
}

/**
 * Get all providers for a specific tier
 */
export function getProvidersByTier(tier: ModelTier): ProviderId[] {
  return TIERED_PROVIDER_LIST.filter((p) => getProviderTier(p) === tier);
}

/**
 * Get free tier models
 */
export function getFreeModels(): ModelInfo[] {
  return ALL_MODELS.filter(isFreeModel);
}
