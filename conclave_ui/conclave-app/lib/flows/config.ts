/**
 * Flow Config Builder Utility
 *
 * Transforms simple UI selections into the complete flow configuration
 * schema expected by the Executor API.
 *
 * Usage:
 * ```typescript
 * const config = buildFlowConfig({
 *   flowType: "round-robin",
 *   models: ["claude", "gpt4", "gemini"],
 *   task: "Analyze this topic..."
 * });
 * ```
 */

// =============================================================================
// Types
// =============================================================================

import {
  type ProviderId,
  MODELS_BY_PROVIDER,
  isOpenRouterProvider,
} from "@/lib/models";

export type FlowType = "round-robin" | "hub-spoke";

// Legacy model IDs for backward compatibility
export type LegacyModelId = "claude" | "gpt4" | "gemini" | "grok";

// New model ID is string to support all models from the tiered system
export type ModelId = LegacyModelId | string;

/**
 * Input from the UI wizard
 */
export interface FlowWizardInput {
  flowType: FlowType;
  models: ModelId[];
  task: string;
  leaderId?: ModelId; // For hub-spoke: the leader model
}

/**
 * Model mapping from UI IDs to Executor format
 */
export interface ModelMapping {
  provider: string;
  model: string;
  displayName: string;
}

/**
 * Participant in a flow
 */
export interface Participant {
  id: string;
  provider: string;
  model: string;
  role?: string;
}

/**
 * Phase in a flow
 */
export interface Phase {
  name: string;
  type: "single" | "parallel" | "sequential";
  executor?: string;
  executors?: string[];
  prompt: string;
}

/**
 * Complete flow configuration for the Executor API
 */
export interface ExecutorFlowConfig {
  version?: string;
  name: string;
  description?: string;
  participants: Participant[];
  phases: Phase[];
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Legacy mapping from old UI model IDs to Executor format
 * Used for backward compatibility
 */
export const LEGACY_MODEL_MAPPING: Record<LegacyModelId, ModelMapping> = {
  claude: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250514",
    displayName: "Claude Sonnet 4.5",
  },
  gpt4: {
    provider: "openai",
    model: "gpt-5.2",
    displayName: "GPT-5.2",
  },
  gemini: {
    provider: "google",
    model: "gemini-3-pro-preview",
    displayName: "Gemini 3 Pro",
  },
  grok: {
    provider: "xai",
    model: "grok-3",
    displayName: "Grok 3",
  },
};

/**
 * Dynamic model mapping - looks up model info from the models registry
 * Falls back to legacy mapping for old model IDs
 */
export const MODEL_MAPPING: Record<string, ModelMapping> = new Proxy(
  LEGACY_MODEL_MAPPING as Record<string, ModelMapping>,
  {
    get(target, prop: string) {
      // First check legacy mapping
      if (prop in target) {
        return target[prop];
      }

      // Try to find model in the new model system
      for (const providerId of Object.keys(MODELS_BY_PROVIDER) as ProviderId[]) {
        const models = MODELS_BY_PROVIDER[providerId];
        const model = models?.find((m) => m.id === prop);
        if (model) {
          return {
            provider: providerId,
            model: model.id,
            displayName: model.name,
          };
        }
      }

      // Return undefined if not found (matches Object behavior)
      return undefined;
    },
    has(target, prop: string) {
      // Check legacy mapping first
      if (prop in target) {
        return true;
      }

      // Check new model system
      for (const providerId of Object.keys(MODELS_BY_PROVIDER) as ProviderId[]) {
        const models = MODELS_BY_PROVIDER[providerId];
        if (models?.some((m) => m.id === prop)) {
          return true;
        }
      }

      return false;
    },
  }
);

/**
 * Provider to environment variable mapping (for API route)
 * Updated to include OpenRouter for open source providers
 */
export const PROVIDER_ENV_KEYS: Record<string, string> = {
  // Premium providers - direct API
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  xai: "XAI_API_KEY",

  // Open source providers - via OpenRouter
  deepseek: "OPENROUTER_API_KEY",
  meta: "OPENROUTER_API_KEY",
  mistral: "OPENROUTER_API_KEY",
  qwen: "OPENROUTER_API_KEY",
  microsoft: "OPENROUTER_API_KEY",
  nvidia: "OPENROUTER_API_KEY",

  // OpenRouter (unified)
  openrouter: "OPENROUTER_API_KEY",
};

/**
 * Check if a provider requires OpenRouter
 */
export function requiresOpenRouter(provider: string): boolean {
  return isOpenRouterProvider(provider as ProviderId);
}

// =============================================================================
// Phase Templates
// =============================================================================

const ROUND_ROBIN_PHASES = {
  initial: {
    name: "Initial Response",
    prompt_template: "{{task}}",
  },
  refinement: {
    name: "Refinement",
    prompt_template: `Original task: {{task}}

Other responses:
{{previous_responses}}

Refine your answer considering these perspectives.`,
  },
};

const HUB_SPOKE_PHASES = {
  contributors: {
    name: "Contributor Responses",
    prompt_template: "{{task}}",
  },
  synthesis: {
    name: "Leader Synthesis",
    prompt_template: `Task: {{task}}

Contributor responses:
{{previous_responses}}

As the lead model, synthesize these perspectives into a comprehensive response.`,
  },
  final: {
    name: "Final Refinement",
    prompt_template: `Task: {{task}}

Synthesis:
{{previous_responses}}

Provide any final thoughts or refinements.`,
  },
};

// =============================================================================
// Builder Functions
// =============================================================================

/**
 * Validate the flow wizard input
 */
export function validateFlowInput(input: FlowWizardInput): string[] {
  const errors: string[] = [];

  // Validate flow type
  if (!input.flowType || !["round-robin", "hub-spoke"].includes(input.flowType)) {
    errors.push("Invalid flow type. Must be 'round-robin' or 'hub-spoke'");
  }

  // Validate models
  if (!input.models || !Array.isArray(input.models)) {
    errors.push("Models must be an array");
  } else if (input.models.length < 2) {
    errors.push("At least 2 models are required");
  } else {
    for (const modelId of input.models) {
      if (!MODEL_MAPPING[modelId as ModelId]) {
        errors.push(`Unknown model: ${modelId}`);
      }
    }
  }

  // Validate task
  if (!input.task || typeof input.task !== "string" || input.task.trim().length === 0) {
    errors.push("Task is required");
  }

  // Validate leader for hub-spoke
  if (input.flowType === "hub-spoke") {
    if (!input.leaderId) {
      errors.push("Hub-spoke flow requires a leader model");
    } else if (!input.models.includes(input.leaderId)) {
      errors.push("Leader must be one of the selected models");
    }
  }

  return errors;
}

/**
 * Build participants array from model IDs
 */
export function buildParticipants(
  modelIds: ModelId[],
  flowType: FlowType,
  leaderId?: ModelId
): Participant[] {
  return modelIds.map((id) => {
    const mapping = MODEL_MAPPING[id];
    return {
      id,
      name: mapping.displayName,
      provider: mapping.provider,
      model: mapping.model,
      role: flowType === "hub-spoke" && id === leaderId ? "leader" : "contributor",
    };
  });
}

/**
 * Build phases for Round-Robin flow
 */
function buildRoundRobinPhases(modelIds: ModelId[]): Phase[] {
  return [
    {
      name: ROUND_ROBIN_PHASES.initial.name,
      type: "parallel",
      executors: [...modelIds],
      prompt: ROUND_ROBIN_PHASES.initial.prompt_template,
    },
    {
      name: ROUND_ROBIN_PHASES.refinement.name,
      type: "parallel",
      executors: [...modelIds],
      prompt: ROUND_ROBIN_PHASES.refinement.prompt_template,
    },
  ];
}

/**
 * Build phases for Hub-and-Spoke flow
 */
function buildHubSpokePhases(modelIds: ModelId[], leaderId: ModelId): Phase[] {
  const contributorIds = modelIds.filter((id) => id !== leaderId);

  return [
    {
      name: HUB_SPOKE_PHASES.contributors.name,
      type: "parallel",
      executors: [...contributorIds],
      prompt: HUB_SPOKE_PHASES.contributors.prompt_template,
    },
    {
      name: HUB_SPOKE_PHASES.synthesis.name,
      type: "single",
      executor: leaderId,
      prompt: HUB_SPOKE_PHASES.synthesis.prompt_template,
    },
    {
      name: HUB_SPOKE_PHASES.final.name,
      type: "parallel",
      executors: [...modelIds],
      prompt: HUB_SPOKE_PHASES.final.prompt_template,
    },
  ];
}

/**
 * Build complete flow configuration from UI input
 */
export function buildFlowConfig(input: FlowWizardInput): ExecutorFlowConfig {
  // Validate input
  const errors = validateFlowInput(input);
  if (errors.length > 0) {
    throw new Error(`Invalid flow input: ${errors.join(", ")}`);
  }

  const { flowType, models, leaderId } = input;
  const modelIds = models as ModelId[];

  // Build participants
  const participants = buildParticipants(modelIds, flowType, leaderId);

  // Build phases based on flow type
  const phases =
    flowType === "round-robin"
      ? buildRoundRobinPhases(modelIds)
      : buildHubSpokePhases(modelIds, leaderId!);

  // Generate flow name
  const flowName =
    flowType === "round-robin"
      ? "Round-Robin Analysis"
      : "Hub-and-Spoke Synthesis";

  return {
    version: "2.0",
    name: flowName,
    description: `${flowName} with ${modelIds.length} models`,
    participants,
    phases,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the display name for a model ID
 */
export function getModelDisplayName(modelId: ModelId): string {
  return MODEL_MAPPING[modelId]?.displayName || modelId;
}

/**
 * Get the provider for a model ID
 */
export function getModelProvider(modelId: ModelId): string {
  return MODEL_MAPPING[modelId]?.provider || "unknown";
}

/**
 * Get unique providers needed for a set of models
 */
export function getRequiredProviders(modelIds: ModelId[]): string[] {
  const providers = new Set<string>();
  for (const modelId of modelIds) {
    const mapping = MODEL_MAPPING[modelId];
    if (mapping) {
      providers.add(mapping.provider);
    }
  }
  return Array.from(providers);
}

/**
 * Check if a model ID is valid
 * Works with both legacy model IDs and new model system
 */
export function isValidModelId(id: string): id is ModelId {
  // Check legacy mapping
  if (id in LEGACY_MODEL_MAPPING) {
    return true;
  }

  // Check new model system
  for (const providerId of Object.keys(MODELS_BY_PROVIDER) as ProviderId[]) {
    const models = MODELS_BY_PROVIDER[providerId];
    if (models?.some((m) => m.id === id)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all available model IDs
 */
export function getAvailableModelIds(): ModelId[] {
  return Object.keys(MODEL_MAPPING) as ModelId[];
}
