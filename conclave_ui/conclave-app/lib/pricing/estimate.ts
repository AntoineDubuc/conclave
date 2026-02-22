/**
 * Cost estimation logic for Conclave flow runs.
 *
 * This module provides functions to estimate the cost of running
 * multi-model flows based on token usage and model pricing.
 *
 * Pricing is based on $/MTok (per million tokens).
 */

// Model pricing data ($/MTok)
// Source: docs/poc/MODELS_AND_PRICING.md
export interface ModelPricing {
  modelId: string;
  displayName: string;
  provider: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  contextWindow: number;
  maxOutput: number;
}

// Pricing data for supported models
// Source: docs/poc/MODELS_AND_PRICING.md (Updated: January 2026)
// NOTE: Model IDs must match those in lib/models/index.ts exactly
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude - Full API model IDs
  "claude-opus-4-6": {
    modelId: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    provider: "Anthropic",
    inputPricePerMTok: 5.0,
    outputPricePerMTok: 25.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
  },
  "claude-sonnet-4-6": {
    modelId: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    provider: "Anthropic",
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
  },
  "claude-haiku-4-5-20251001": {
    modelId: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    provider: "Anthropic",
    inputPricePerMTok: 1.0,
    outputPricePerMTok: 5.0,
    contextWindow: 200_000,
    maxOutput: 64_000,
  },
  "claude-opus-4-5-20251101": {
    modelId: "claude-opus-4-5-20251101",
    displayName: "Claude Opus 4.5",
    provider: "Anthropic",
    inputPricePerMTok: 5.0,
    outputPricePerMTok: 25.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
  },
  "claude-opus-4-20250514": {
    modelId: "claude-opus-4-20250514",
    displayName: "Claude Opus 4",
    provider: "Anthropic",
    inputPricePerMTok: 15.0,
    outputPricePerMTok: 75.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
  },
  "claude-sonnet-4-20250514": {
    modelId: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    provider: "Anthropic",
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
  },
  // Anthropic Claude - Short aliases (for backwards compatibility)
  "claude-sonnet-4.5": {
    modelId: "claude-sonnet-4.5",
    displayName: "Claude Sonnet 4.5",
    provider: "Anthropic",
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
  },
  "claude-opus-4.5": {
    modelId: "claude-opus-4.5",
    displayName: "Claude Opus 4.5",
    provider: "Anthropic",
    inputPricePerMTok: 5.0,
    outputPricePerMTok: 25.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
  },
  "claude-haiku-4.5": {
    modelId: "claude-haiku-4.5",
    displayName: "Claude Haiku 4.5",
    provider: "Anthropic",
    inputPricePerMTok: 1.0,
    outputPricePerMTok: 5.0,
    contextWindow: 200_000,
    maxOutput: 64_000,
  },
  "claude-sonnet-4": {
    modelId: "claude-sonnet-4",
    displayName: "Claude Sonnet 4",
    provider: "Anthropic",
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
  },
  "claude-opus-4": {
    modelId: "claude-opus-4",
    displayName: "Claude Opus 4",
    provider: "Anthropic",
    inputPricePerMTok: 15.0,
    outputPricePerMTok: 75.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
  },

  // OpenAI - Full model IDs from lib/models/index.ts
  "gpt-5.2": {
    modelId: "gpt-5.2",
    displayName: "GPT-5.2",
    provider: "OpenAI",
    inputPricePerMTok: 1.75,
    outputPricePerMTok: 14.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
  },
  "gpt-5.1": {
    modelId: "gpt-5.1",
    displayName: "GPT-5.1",
    provider: "OpenAI",
    inputPricePerMTok: 1.25,
    outputPricePerMTok: 10.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
  },
  "gpt-5": {
    modelId: "gpt-5",
    displayName: "GPT-5",
    provider: "OpenAI",
    inputPricePerMTok: 1.25,
    outputPricePerMTok: 10.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
  },
  "gpt-5-mini": {
    modelId: "gpt-5-mini",
    displayName: "GPT-5 Mini",
    provider: "OpenAI",
    inputPricePerMTok: 0.25,
    outputPricePerMTok: 2.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
  },
  "gpt-5-nano": {
    modelId: "gpt-5-nano",
    displayName: "GPT-5 Nano",
    provider: "OpenAI",
    inputPricePerMTok: 0.05,
    outputPricePerMTok: 0.4,
    contextWindow: 400_000,
    maxOutput: 128_000,
  },
  "gpt-4.1": {
    modelId: "gpt-4.1",
    displayName: "GPT-4.1",
    provider: "OpenAI",
    inputPricePerMTok: 2.0,
    outputPricePerMTok: 8.0,
    contextWindow: 1_000_000,
    maxOutput: 32_000,
  },
  "gpt-4.1-mini": {
    modelId: "gpt-4.1-mini",
    displayName: "GPT-4.1 Mini",
    provider: "OpenAI",
    inputPricePerMTok: 0.4,
    outputPricePerMTok: 1.6,
    contextWindow: 1_000_000,
    maxOutput: 32_000,
  },
  "gpt-4.1-nano": {
    modelId: "gpt-4.1-nano",
    displayName: "GPT-4.1 Nano",
    provider: "OpenAI",
    inputPricePerMTok: 0.1,
    outputPricePerMTok: 0.4,
    contextWindow: 1_000_000,
    maxOutput: 32_000,
  },
  "o3": {
    modelId: "o3",
    displayName: "o3 (Reasoning)",
    provider: "OpenAI",
    inputPricePerMTok: 2.0,
    outputPricePerMTok: 8.0,
    contextWindow: 200_000,
    maxOutput: 100_000,
  },
  "o4-mini": {
    modelId: "o4-mini",
    displayName: "o4-mini (Reasoning)",
    provider: "OpenAI",
    inputPricePerMTok: 1.1,
    outputPricePerMTok: 4.4,
    contextWindow: 200_000,
    maxOutput: 100_000,
  },

  // Google Gemini
  "gemini-3-pro-preview": {
    modelId: "gemini-3-pro-preview",
    displayName: "Gemini 3 Pro",
    provider: "Google",
    inputPricePerMTok: 2.0,
    outputPricePerMTok: 15.0,
    contextWindow: 1_048_576,
    maxOutput: 65_536,
  },
  "gemini-3-flash-preview": {
    modelId: "gemini-3-flash-preview",
    displayName: "Gemini 3 Flash",
    provider: "Google",
    inputPricePerMTok: 0.5,
    outputPricePerMTok: 4.0,
    contextWindow: 1_048_576,
    maxOutput: 65_536,
  },
  "gemini-2.5-pro": {
    modelId: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "Google",
    inputPricePerMTok: 1.25,
    outputPricePerMTok: 10.0,
    contextWindow: 1_000_000,
    maxOutput: 65_000,
  },
  "gemini-2.5-flash": {
    modelId: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "Google",
    inputPricePerMTok: 0.3,
    outputPricePerMTok: 2.5,
    contextWindow: 1_000_000,
    maxOutput: 65_000,
  },
  "gemini-2.5-flash-lite": {
    modelId: "gemini-2.5-flash-lite",
    displayName: "Gemini 2.5 Flash-Lite",
    provider: "Google",
    inputPricePerMTok: 0.1,
    outputPricePerMTok: 0.4,
    contextWindow: 1_000_000,
    maxOutput: 65_000,
  },

  // xAI Grok
  "grok-3": {
    modelId: "grok-3",
    displayName: "Grok 3",
    provider: "xAI",
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
    contextWindow: 131_072,
    maxOutput: 32_000,
  },
  "grok-3-fast": {
    modelId: "grok-3-fast",
    displayName: "Grok 3 Fast",
    provider: "xAI",
    inputPricePerMTok: 0.6,
    outputPricePerMTok: 4.0,
    contextWindow: 131_072,
    maxOutput: 32_000,
  },
  "grok-3-mini": {
    modelId: "grok-3-mini",
    displayName: "Grok 3 Mini",
    provider: "xAI",
    inputPricePerMTok: 0.3,
    outputPricePerMTok: 0.5,
    contextWindow: 131_072,
    maxOutput: 32_000,
  },
  "grok-3-mini-fast": {
    modelId: "grok-3-mini-fast",
    displayName: "Grok 3 Mini Fast",
    provider: "xAI",
    inputPricePerMTok: 0.1,
    outputPricePerMTok: 0.4,
    contextWindow: 131_072,
    maxOutput: 32_000,
  },

  // ==========================================================================
  // Open Source Models (via OpenRouter)
  // ==========================================================================

  // DeepSeek
  "deepseek-r1": {
    modelId: "deepseek-r1",
    displayName: "DeepSeek R1",
    provider: "DeepSeek",
    inputPricePerMTok: 0.70,
    outputPricePerMTok: 2.50,
    contextWindow: 163_000,
    maxOutput: 65_000,
  },
  "deepseek-chat-v3": {
    modelId: "deepseek-chat-v3",
    displayName: "DeepSeek Chat V3",
    provider: "DeepSeek",
    inputPricePerMTok: 0.19,
    outputPricePerMTok: 0.87,
    contextWindow: 163_000,
    maxOutput: 65_000,
  },
  "deepseek-r1-free": {
    modelId: "deepseek-r1-free",
    displayName: "DeepSeek R1 Free",
    provider: "DeepSeek",
    inputPricePerMTok: 0,
    outputPricePerMTok: 0,
    contextWindow: 163_000,
    maxOutput: 65_000,
  },

  // Meta (Llama)
  "llama-4-scout": {
    modelId: "llama-4-scout",
    displayName: "Llama 4 Scout",
    provider: "Meta",
    inputPricePerMTok: 0.08,
    outputPricePerMTok: 0.30,
    contextWindow: 327_000,
    maxOutput: 16_000,
  },
  "llama-4-maverick": {
    modelId: "llama-4-maverick",
    displayName: "Llama 4 Maverick",
    provider: "Meta",
    inputPricePerMTok: 0.15,
    outputPricePerMTok: 0.60,
    contextWindow: 1_000_000,
    maxOutput: 16_000,
  },

  // Mistral
  "mistral-large-2411": {
    modelId: "mistral-large-2411",
    displayName: "Mistral Large 2411",
    provider: "Mistral",
    inputPricePerMTok: 2.00,
    outputPricePerMTok: 6.00,
    contextWindow: 128_000,
    maxOutput: 8_192,
  },
  "mistral-small-3.1-24b": {
    modelId: "mistral-small-3.1-24b",
    displayName: "Mistral Small 3.1 24B",
    provider: "Mistral",
    inputPricePerMTok: 0.03,
    outputPricePerMTok: 0.11,
    contextWindow: 128_000,
    maxOutput: 8_192,
  },
  "codestral-2508": {
    modelId: "codestral-2508",
    displayName: "Codestral 2508",
    provider: "Mistral",
    inputPricePerMTok: 0.30,
    outputPricePerMTok: 0.90,
    contextWindow: 256_000,
    maxOutput: 8_192,
  },

  // Qwen
  "qwen3-235b-a22b": {
    modelId: "qwen3-235b-a22b",
    displayName: "Qwen3 235B A22B",
    provider: "Qwen",
    inputPricePerMTok: 0.20,
    outputPricePerMTok: 0.60,
    contextWindow: 131_000,
    maxOutput: 8_192,
  },
  "qwen3-32b": {
    modelId: "qwen3-32b",
    displayName: "Qwen3 32B",
    provider: "Qwen",
    inputPricePerMTok: 0.08,
    outputPricePerMTok: 0.24,
    contextWindow: 131_000,
    maxOutput: 8_192,
  },
  "qwq-32b": {
    modelId: "qwq-32b",
    displayName: "QwQ 32B",
    provider: "Qwen",
    inputPricePerMTok: 0.15,
    outputPricePerMTok: 0.40,
    contextWindow: 131_000,
    maxOutput: 8_192,
  },

  // Microsoft
  "phi-4": {
    modelId: "phi-4",
    displayName: "Microsoft Phi-4",
    provider: "Microsoft",
    inputPricePerMTok: 0.06,
    outputPricePerMTok: 0.14,
    contextWindow: 16_000,
    maxOutput: 4_096,
  },

  // NVIDIA
  "nemotron-30b-free": {
    modelId: "nemotron-30b-free",
    displayName: "NVIDIA Nemotron 30B",
    provider: "NVIDIA",
    inputPricePerMTok: 0,
    outputPricePerMTok: 0,
    contextWindow: 131_000,
    maxOutput: 4_096,
  },
};

/**
 * Flow type determines how many rounds of API calls will be made.
 */
export type FlowType = "round-robin" | "hub-spoke";

/**
 * Configuration for a model participating in a flow.
 */
export interface FlowModelConfig {
  modelId: string;
  isLeader?: boolean; // Only relevant for hub-spoke flows
}

/**
 * Per-model cost breakdown.
 */
export interface ModelCostBreakdown {
  modelId: string;
  displayName: string;
  provider: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

/**
 * Complete cost estimate for a flow run.
 */
export interface FlowCostEstimate {
  flowType: FlowType;
  rounds: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  perModelBreakdown: ModelCostBreakdown[];
  subtotal: number;
  markup: number;
  markupPercentage: number;
  totalCost: number;
}

/**
 * Tier data for markup calculation.
 */
export interface TierData {
  tier: number;
  name: string;
  minSpend: number;
  maxSpend: number | null;
  markup: number;
}

// Default tier data matching tier-table.tsx
const DEFAULT_TIERS: TierData[] = [
  { tier: 1, name: "Tier 1", minSpend: 0, maxSpend: 25, markup: 30 },
  { tier: 2, name: "Tier 2", minSpend: 25, maxSpend: 100, markup: 25 },
  { tier: 3, name: "Tier 3", minSpend: 100, maxSpend: 500, markup: 20 },
  { tier: 4, name: "Tier 4", minSpend: 500, maxSpend: null, markup: 15 },
];

/**
 * Get the markup percentage for a given lifetime spend.
 */
export function getMarkupPercentage(
  lifetimeSpend: number,
  tiers: TierData[] = DEFAULT_TIERS
): number {
  // Find the applicable tier (highest tier where minSpend <= lifetimeSpend)
  const applicableTier = tiers
    .filter((t) => lifetimeSpend >= t.minSpend)
    .sort((a, b) => b.tier - a.tier)[0];

  return applicableTier?.markup ?? tiers[0].markup;
}

/**
 * Get model pricing info, with fallback for unknown models.
 */
export function getModelPricing(modelId: string): ModelPricing {
  if (MODEL_PRICING[modelId]) {
    return MODEL_PRICING[modelId];
  }

  // Fallback pricing for unknown models (conservative estimate)
  return {
    modelId,
    displayName: modelId,
    provider: "Unknown",
    inputPricePerMTok: 5.0,
    outputPricePerMTok: 15.0,
    contextWindow: 128_000,
    maxOutput: 4_096,
  };
}

/**
 * Calculate cost from tokens and price per million tokens.
 */
function calculateTokenCost(tokens: number, pricePerMTok: number): number {
  return (tokens * pricePerMTok) / 1_000_000;
}

/**
 * Estimate input tokens from prompt text.
 * Uses a rough approximation: ~4 characters per token for English text.
 *
 * TODO: Replace with actual tokenizer for more accurate estimates.
 */
export function estimateInputTokens(promptText: string): number {
  // Rough estimate: 1 token ~= 4 characters for English
  // This is a simplification; actual tokenization varies by model
  const charCount = promptText.length;
  const estimatedTokens = Math.ceil(charCount / 4);

  // Add overhead for system prompts and formatting (~200 tokens)
  return estimatedTokens + 200;
}

/**
 * Estimate output tokens for a model based on typical response length.
 *
 * This is a heuristic based on typical usage patterns:
 * - Simple responses: ~500 tokens
 * - Medium complexity: ~1500 tokens
 * - Complex tasks: ~4000 tokens
 *
 * For multi-model flows, we use a medium estimate.
 */
export function estimateOutputTokens(
  modelId: string,
  _promptText: string,
  isRefinementRound: boolean = false
): number {
  const pricing = getModelPricing(modelId);

  // Base estimate for initial response
  let baseEstimate = 1500;

  // Refinement rounds typically produce shorter responses
  if (isRefinementRound) {
    baseEstimate = 1000;
  }

  // Cap at model's max output
  return Math.min(baseEstimate, pricing.maxOutput);
}

/**
 * Configuration for cost estimation.
 */
export interface EstimateFlowCostOptions {
  /** The type of flow being run */
  flowType: FlowType;
  /** Models participating in the flow */
  models: FlowModelConfig[];
  /** The user's prompt text */
  promptText: string;
  /** Number of rounds (default: 2 for round-robin, 1 for hub-spoke) */
  rounds?: number;
  /** User's lifetime spend for markup calculation */
  lifetimeSpend?: number;
  /** Custom tiers for markup calculation */
  tiers?: TierData[];
}

/**
 * Estimate the total cost of running a flow.
 *
 * Cost calculation:
 * 1. For each model, estimate input and output tokens
 * 2. Calculate raw API cost per model
 * 3. Sum all model costs for subtotal
 * 4. Apply tier-based markup
 * 5. Return total with breakdown
 */
export function estimateFlowCost(options: EstimateFlowCostOptions): FlowCostEstimate {
  const {
    flowType,
    models,
    promptText,
    rounds = flowType === "round-robin" ? 2 : 1,
    lifetimeSpend = 0,
    tiers = DEFAULT_TIERS,
  } = options;

  const baseInputTokens = estimateInputTokens(promptText);
  const markupPercentage = getMarkupPercentage(lifetimeSpend, tiers);

  const perModelBreakdown: ModelCostBreakdown[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let subtotal = 0;

  for (const modelConfig of models) {
    const pricing = getModelPricing(modelConfig.modelId);

    // Calculate tokens per model
    // Round 1: base input tokens
    // Round 2+: base input + previous outputs from other models (~2000 tokens each)
    let modelInputTokens = baseInputTokens;
    if (rounds > 1) {
      // Additional context from other models' responses in subsequent rounds
      const otherModelsOutput = (models.length - 1) * 1500;
      modelInputTokens += otherModelsOutput * (rounds - 1);
    }

    // Output tokens across all rounds
    let modelOutputTokens = 0;
    for (let round = 1; round <= rounds; round++) {
      const isRefinement = round > 1;
      modelOutputTokens += estimateOutputTokens(modelConfig.modelId, promptText, isRefinement);
    }

    // Hub-spoke: leader model has additional synthesis work
    if (flowType === "hub-spoke" && modelConfig.isLeader) {
      // Leader reads all other responses for synthesis
      const synthesisInput = (models.length - 1) * 1500;
      modelInputTokens += synthesisInput;
      // Leader produces a longer synthesis
      modelOutputTokens += 2000;
    }

    // Calculate costs
    const inputCost = calculateTokenCost(modelInputTokens, pricing.inputPricePerMTok);
    const outputCost = calculateTokenCost(modelOutputTokens, pricing.outputPricePerMTok);
    const totalCost = inputCost + outputCost;

    perModelBreakdown.push({
      modelId: modelConfig.modelId,
      displayName: pricing.displayName,
      provider: pricing.provider,
      estimatedInputTokens: modelInputTokens,
      estimatedOutputTokens: modelOutputTokens,
      inputCost,
      outputCost,
      totalCost,
    });

    totalInputTokens += modelInputTokens;
    totalOutputTokens += modelOutputTokens;
    subtotal += totalCost;
  }

  // Apply markup
  const markup = subtotal * (markupPercentage / 100);
  const totalCost = subtotal + markup;

  return {
    flowType,
    rounds,
    totalInputTokens,
    totalOutputTokens,
    perModelBreakdown,
    subtotal,
    markup,
    markupPercentage,
    totalCost,
  };
}

/**
 * Format currency for display.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

/**
 * Format token count for display.
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}
