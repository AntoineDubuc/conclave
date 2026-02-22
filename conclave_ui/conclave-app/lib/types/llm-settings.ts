/**
 * LLM Settings Types
 *
 * TypeScript types and interfaces for LLM configuration
 * used throughout the Human-in-the-Loop feature.
 */

import type { ProviderId } from "@/lib/models";

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Provider type - aliased from ProviderId for backward compatibility
 * @deprecated Use ProviderId from @/lib/models instead
 */
export type Provider = ProviderId;

// =============================================================================
// LLM Settings Interface
// =============================================================================

/**
 * LLM settings that can be configured per-agent
 */
export interface LLMSettings {
  /** Model identifier (e.g., "claude-sonnet-4-20250514", "gpt-4o") */
  model: string;

  /** Controls randomness. Range varies by provider:
   * - Anthropic: 0-1
   * - OpenAI: 0-2
   * - Google: 0-2
   * - xAI: 0-2
   */
  temperature: number;

  /** Maximum tokens in the response */
  maxTokens: number;

  /** Nucleus sampling parameter (0-1). Not supported by all providers. */
  topP?: number;

  /** Presence penalty (-2 to 2). OpenAI only. */
  presencePenalty?: number;

  /** Frequency penalty (-2 to 2). OpenAI only. */
  frequencyPenalty?: number;
}

/**
 * Agent configuration including system prompt and LLM settings
 */
export interface AgentConfig {
  /** Agent identifier (matches participant id) */
  id: string;

  /** Provider name */
  provider: Provider;

  /** Actual model ID (API model identifier) */
  modelId?: string;

  /** Display name for the agent */
  displayName: string;

  /** Role in the flow (leader/contributor) */
  role: "leader" | "contributor";

  /** System prompt for this agent */
  systemPrompt: string;

  /** LLM settings */
  settings: LLMSettings;
}

// =============================================================================
// Presets
// =============================================================================

export type PresetName = "creative" | "balanced" | "precise";

export interface Preset {
  name: PresetName;
  label: string;
  description: string;
  settings: Partial<LLMSettings>;
}

export const PRESETS: Record<PresetName, Preset> = {
  creative: {
    name: "creative",
    label: "Creative",
    description: "Higher temperature for more creative, varied outputs",
    settings: {
      temperature: 1.0,
      topP: 0.95,
    },
  },
  balanced: {
    name: "balanced",
    label: "Balanced",
    description: "Middle ground between creativity and consistency",
    settings: {
      temperature: 0.7,
      topP: 0.9,
    },
  },
  precise: {
    name: "precise",
    label: "Precise",
    description: "Lower temperature for more focused, deterministic outputs",
    settings: {
      temperature: 0.3,
      topP: 0.8,
    },
  },
};

// =============================================================================
// Provider Constraints
// =============================================================================

export interface ProviderConstraints {
  temperature: { min: number; max: number; default: number };
  maxTokens: { min: number; max: number; default: number };
  topP?: { min: number; max: number; default: number };
  presencePenalty?: { min: number; max: number; default: number };
  frequencyPenalty?: { min: number; max: number; default: number };
}

export const PROVIDER_CONSTRAINTS: Record<Provider, ProviderConstraints> = {
  // Premium Providers (Direct API)
  anthropic: {
    temperature: { min: 0, max: 1, default: 0.7 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    // Anthropic doesn't support presence/frequency penalties
  },
  openai: {
    temperature: { min: 0, max: 2, default: 0.7 },
    maxTokens: { min: 1, max: 16384, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    presencePenalty: { min: -2, max: 2, default: 0 },
    frequencyPenalty: { min: -2, max: 2, default: 0 },
  },
  google: {
    temperature: { min: 0, max: 2, default: 0.7 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    // Google doesn't support presence/frequency penalties
  },
  xai: {
    temperature: { min: 0, max: 2, default: 0.7 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    // xAI doesn't support presence/frequency penalties
  },
  // Open Source Providers (via OpenRouter)
  deepseek: {
    temperature: { min: 0, max: 2, default: 0.7 },
    maxTokens: { min: 1, max: 65000, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    // DeepSeek doesn't support presence/frequency penalties via OpenRouter
  },
  meta: {
    temperature: { min: 0, max: 2, default: 0.7 },
    maxTokens: { min: 1, max: 16000, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    // Llama doesn't support presence/frequency penalties
  },
  mistral: {
    temperature: { min: 0, max: 2, default: 0.7 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    // Mistral doesn't support presence/frequency penalties
  },
  qwen: {
    temperature: { min: 0, max: 2, default: 0.7 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    // Qwen doesn't support presence/frequency penalties
  },
  // Other Providers (via OpenRouter)
  microsoft: {
    temperature: { min: 0, max: 2, default: 0.7 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    // Phi doesn't support presence/frequency penalties
  },
  nvidia: {
    temperature: { min: 0, max: 2, default: 0.7 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
    topP: { min: 0, max: 1, default: 0.9 },
    // Nemotron doesn't support presence/frequency penalties
  },
};

// =============================================================================
// Model Metadata
// =============================================================================

export interface ModelMetadata {
  id: string;
  name: string;
  provider: Provider;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsTopP: boolean;
  supportsPresencePenalty: boolean;
  supportsFrequencyPenalty: boolean;
}

/**
 * Model metadata for LLM settings configuration
 * Updated: January 2026 with latest flagship models
 */
export const MODEL_METADATA: Record<string, ModelMetadata> = {
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    maxContextTokens: 1000000, // 1M context
    maxOutputTokens: 64000,
    supportsTopP: true,
    supportsPresencePenalty: false,
    supportsFrequencyPenalty: false,
  },
  "gpt-5.2": {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    maxContextTokens: 400000,
    maxOutputTokens: 128000,
    supportsTopP: true,
    supportsPresencePenalty: true,
    supportsFrequencyPenalty: true,
  },
  "gemini-3-pro-preview": {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "google",
    maxContextTokens: 1048576, // 1M context
    maxOutputTokens: 65536,
    supportsTopP: true,
    supportsPresencePenalty: false,
    supportsFrequencyPenalty: false,
  },
  "grok-3": {
    id: "grok-3",
    name: "Grok 3",
    provider: "xai",
    maxContextTokens: 131072,
    maxOutputTokens: 32768,
    supportsTopP: true,
    supportsPresencePenalty: false,
    supportsFrequencyPenalty: false,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get default LLM settings for a model
 */
export function getDefaultSettings(modelId: string): LLMSettings {
  const metadata = MODEL_METADATA[modelId];
  if (!metadata) {
    // Fallback defaults
    return {
      model: modelId,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
    };
  }

  const constraints = PROVIDER_CONSTRAINTS[metadata.provider];

  return {
    model: modelId,
    temperature: constraints.temperature.default,
    maxTokens: constraints.maxTokens.default,
    topP: constraints.topP?.default,
    presencePenalty: constraints.presencePenalty?.default,
    frequencyPenalty: constraints.frequencyPenalty?.default,
  };
}

/**
 * Validate LLM settings against provider constraints
 */
export function validateSettings(
  settings: LLMSettings,
  provider: Provider
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const constraints = PROVIDER_CONSTRAINTS[provider];

  // Temperature
  if (
    settings.temperature < constraints.temperature.min ||
    settings.temperature > constraints.temperature.max
  ) {
    errors.push(
      `Temperature must be between ${constraints.temperature.min} and ${constraints.temperature.max} for ${provider}`
    );
  }

  // Max tokens
  if (
    settings.maxTokens < constraints.maxTokens.min ||
    settings.maxTokens > constraints.maxTokens.max
  ) {
    errors.push(
      `Max tokens must be between ${constraints.maxTokens.min} and ${constraints.maxTokens.max} for ${provider}`
    );
  }

  // Top P
  if (settings.topP !== undefined && constraints.topP) {
    if (settings.topP < constraints.topP.min || settings.topP > constraints.topP.max) {
      errors.push(
        `Top P must be between ${constraints.topP.min} and ${constraints.topP.max} for ${provider}`
      );
    }
  }

  // Presence penalty (OpenAI only)
  if (settings.presencePenalty !== undefined) {
    if (!constraints.presencePenalty) {
      errors.push(`Presence penalty is not supported by ${provider}`);
    } else if (
      settings.presencePenalty < constraints.presencePenalty.min ||
      settings.presencePenalty > constraints.presencePenalty.max
    ) {
      errors.push(
        `Presence penalty must be between ${constraints.presencePenalty.min} and ${constraints.presencePenalty.max}`
      );
    }
  }

  // Frequency penalty (OpenAI only)
  if (settings.frequencyPenalty !== undefined) {
    if (!constraints.frequencyPenalty) {
      errors.push(`Frequency penalty is not supported by ${provider}`);
    } else if (
      settings.frequencyPenalty < constraints.frequencyPenalty.min ||
      settings.frequencyPenalty > constraints.frequencyPenalty.max
    ) {
      errors.push(
        `Frequency penalty must be between ${constraints.frequencyPenalty.min} and ${constraints.frequencyPenalty.max}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Apply a preset to existing settings
 */
export function applyPreset(
  settings: LLMSettings,
  preset: PresetName,
  provider: Provider
): LLMSettings {
  const presetValues = PRESETS[preset].settings;
  const constraints = PROVIDER_CONSTRAINTS[provider];

  // Clamp temperature to provider's max
  let temperature = presetValues.temperature ?? settings.temperature;
  temperature = Math.min(temperature, constraints.temperature.max);

  return {
    ...settings,
    temperature,
    topP: presetValues.topP ?? settings.topP,
  };
}

/**
 * Clamp settings to provider constraints
 */
export function clampToConstraints(settings: LLMSettings, provider: Provider): LLMSettings {
  const constraints = PROVIDER_CONSTRAINTS[provider];

  return {
    ...settings,
    temperature: Math.max(
      constraints.temperature.min,
      Math.min(constraints.temperature.max, settings.temperature)
    ),
    maxTokens: Math.max(
      constraints.maxTokens.min,
      Math.min(constraints.maxTokens.max, settings.maxTokens)
    ),
    topP: settings.topP !== undefined && constraints.topP
      ? Math.max(constraints.topP.min, Math.min(constraints.topP.max, settings.topP))
      : settings.topP,
    presencePenalty:
      settings.presencePenalty !== undefined && constraints.presencePenalty
        ? Math.max(
            constraints.presencePenalty.min,
            Math.min(constraints.presencePenalty.max, settings.presencePenalty)
          )
        : undefined,
    frequencyPenalty:
      settings.frequencyPenalty !== undefined && constraints.frequencyPenalty
        ? Math.max(
            constraints.frequencyPenalty.min,
            Math.min(constraints.frequencyPenalty.max, settings.frequencyPenalty)
          )
        : undefined,
  };
}
