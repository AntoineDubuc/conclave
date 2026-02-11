/**
 * Flow Defaults
 *
 * Default system prompts per flow type and role, and default
 * settings per model for the Human-in-the-Loop feature.
 */

import type { FlowType, ModelId } from "./config";
import type { AgentConfig, LLMSettings, Provider } from "../types/llm-settings";
import {
  getDefaultSettings,
  PROVIDER_CONSTRAINTS,
  MODEL_METADATA,
} from "../types/llm-settings";
import { MODEL_MAPPING } from "./config";
import { getModelById, type ProviderId, type ModelInfo } from "../models";

// =============================================================================
// System Prompt Templates
// =============================================================================

export interface SystemPromptTemplate {
  role: "leader" | "contributor";
  flowType: FlowType;
  template: string;
}

/**
 * Available template variables:
 * - {{task}} - The user's task/question
 * - {{previous_responses}} - Responses from previous phases
 * - {{agent_name}} - The display name of this agent
 * - {{other_agents}} - Names of other participating agents
 */

const ROUND_ROBIN_CONTRIBUTOR_PROMPT = `You are {{agent_name}}, participating in a collaborative analysis with {{other_agents}}.

Your role is to provide your unique perspective on the given task. Focus on:
- Your distinctive strengths and analytical approach
- Insights that complement rather than duplicate other perspectives
- Clear, well-structured responses

In refinement phases, you will see responses from other participants. Build on their insights while adding new value.`;

const ROUND_ROBIN_INITIAL_PHASE_PROMPT = `{{task}}`;

const ROUND_ROBIN_REFINEMENT_PHASE_PROMPT = `Original task: {{task}}

Other responses:
{{previous_responses}}

Refine your answer considering these perspectives. Add new insights, address gaps, and synthesize the best ideas.`;

const HUB_SPOKE_LEADER_PROMPT = `You are {{agent_name}}, the lead synthesizer in a collaborative analysis with {{other_agents}}.

Your role is to:
1. Collect and understand contributions from other participants
2. Synthesize diverse perspectives into a coherent, comprehensive response
3. Identify areas of agreement, disagreement, and unique insights
4. Produce a final synthesis that represents the best collective thinking

Be fair and balanced in representing all viewpoints while adding your own analytical judgment.`;

const HUB_SPOKE_CONTRIBUTOR_PROMPT = `You are {{agent_name}}, a contributor in a collaborative analysis led by the designated synthesizer.

Your role is to:
- Provide your unique perspective and expertise on the given task
- Focus on your distinctive analytical strengths
- Offer clear, actionable insights

Your response will be synthesized with contributions from other participants.`;

const HUB_SPOKE_SYNTHESIS_PROMPT = `Task: {{task}}

Contributor responses:
{{previous_responses}}

As the lead synthesizer, create a comprehensive synthesis that:
1. Captures key insights from each contributor
2. Identifies areas of agreement and divergence
3. Adds your own analytical perspective
4. Produces a unified, coherent response`;

const HUB_SPOKE_FINAL_PROMPT = `Task: {{task}}

Synthesis:
{{previous_responses}}

Review the synthesis and provide any final thoughts, refinements, or additional perspectives.`;

// =============================================================================
// System Prompt Retrieval
// =============================================================================

export interface SystemPromptConfig {
  agentPrompt: string;
  phasePrompts: Record<string, string>;
}

/**
 * Get default system prompt configuration for an agent
 */
export function getDefaultSystemPromptConfig(
  flowType: FlowType,
  role: "leader" | "contributor",
  agentName: string,
  otherAgentNames: string[]
): SystemPromptConfig {
  const othersText = otherAgentNames.join(", ");

  if (flowType === "round-robin") {
    return {
      agentPrompt: ROUND_ROBIN_CONTRIBUTOR_PROMPT
        .replace(/\{\{agent_name\}\}/g, agentName)
        .replace(/\{\{other_agents\}\}/g, othersText),
      phasePrompts: {
        "Initial Response": ROUND_ROBIN_INITIAL_PHASE_PROMPT,
        Refinement: ROUND_ROBIN_REFINEMENT_PHASE_PROMPT,
      },
    };
  }

  // Hub-Spoke
  if (role === "leader") {
    return {
      agentPrompt: HUB_SPOKE_LEADER_PROMPT
        .replace(/\{\{agent_name\}\}/g, agentName)
        .replace(/\{\{other_agents\}\}/g, othersText),
      phasePrompts: {
        "Leader Synthesis": HUB_SPOKE_SYNTHESIS_PROMPT,
        "Final Refinement": HUB_SPOKE_FINAL_PROMPT,
      },
    };
  }

  return {
    agentPrompt: HUB_SPOKE_CONTRIBUTOR_PROMPT
      .replace(/\{\{agent_name\}\}/g, agentName)
      .replace(/\{\{other_agents\}\}/g, othersText),
    phasePrompts: {
      "Contributor Responses": ROUND_ROBIN_INITIAL_PHASE_PROMPT,
      "Final Refinement": HUB_SPOKE_FINAL_PROMPT,
    },
  };
}

/**
 * Get just the agent system prompt (simpler API)
 */
export function getDefaultSystemPrompt(
  flowType: FlowType,
  role: "leader" | "contributor",
  agentName: string,
  otherAgentNames: string[]
): string {
  return getDefaultSystemPromptConfig(flowType, role, agentName, otherAgentNames).agentPrompt;
}

// =============================================================================
// Agent Configuration Builder
// =============================================================================

/**
 * Build complete agent configurations from model selections
 */
export function buildAgentConfigs(
  modelIds: ModelId[],
  flowType: FlowType,
  leaderId?: ModelId
): AgentConfig[] {
  const configs: AgentConfig[] = [];

  // Get all display names for the "other agents" text
  const allNames = modelIds.map((id) => MODEL_MAPPING[id].displayName);

  for (const modelId of modelIds) {
    const mapping = MODEL_MAPPING[modelId];
    const role: "leader" | "contributor" =
      flowType === "hub-spoke" && modelId === leaderId ? "leader" : "contributor";

    // Other agents (excluding self)
    const otherNames = allNames.filter((name) => name !== mapping.displayName);

    // Get default system prompt
    const systemPrompt = getDefaultSystemPrompt(
      flowType,
      role,
      mapping.displayName,
      otherNames
    );

    // Get default LLM settings
    const settings = getDefaultSettings(mapping.model);

    configs.push({
      id: modelId,
      provider: mapping.provider as Provider,
      displayName: mapping.displayName,
      role,
      systemPrompt,
      settings,
    });
  }

  return configs;
}

/**
 * ModelSelection format from the new model picker
 */
export interface ModelSelection {
  providerId: ProviderId;
  modelId: string;
}

/**
 * Build agent configurations from new ModelSelection format
 */
export function buildAgentConfigsFromSelection(
  selections: ModelSelection[],
  flowType: FlowType,
  leaderProviderId?: ProviderId
): AgentConfig[] {
  const configs: AgentConfig[] = [];

  // Get all display names for the "other agents" text
  const allNames = selections.map((s) => {
    const model = getModelById(s.modelId);
    return model?.name || s.providerId;
  });

  for (const selection of selections) {
    const model = getModelById(selection.modelId);
    if (!model) continue;

    const role: "leader" | "contributor" =
      flowType === "hub-spoke" && selection.providerId === leaderProviderId
        ? "leader"
        : "contributor";

    // Other agents (excluding self)
    const otherNames = allNames.filter((name) => name !== model.name);

    // Get default system prompt
    const systemPrompt = getDefaultSystemPrompt(
      flowType,
      role,
      model.name,
      otherNames
    );

    // Get default LLM settings
    const settings = getDefaultSettings(model.id);

    configs.push({
      id: selection.providerId, // Use providerId as the agent ID for uniqueness
      provider: selection.providerId as Provider,
      displayName: model.name,
      role,
      systemPrompt,
      settings,
      modelId: model.id, // Store the actual model ID
    });
  }

  return configs;
}

// =============================================================================
// Settings Defaults by Model
// =============================================================================

/**
 * Get recommended settings for a specific use case
 */
export type UseCase = "analysis" | "creative" | "coding" | "conversation";

export function getSettingsForUseCase(modelId: string, useCase: UseCase): LLMSettings {
  const baseSettings = getDefaultSettings(modelId);
  const metadata = MODEL_METADATA[modelId];

  if (!metadata) {
    return baseSettings;
  }

  const constraints = PROVIDER_CONSTRAINTS[metadata.provider];

  switch (useCase) {
    case "analysis":
      return {
        ...baseSettings,
        temperature: Math.min(0.5, constraints.temperature.max),
        topP: 0.85,
      };

    case "creative":
      return {
        ...baseSettings,
        temperature: Math.min(1.0, constraints.temperature.max),
        topP: 0.95,
      };

    case "coding":
      return {
        ...baseSettings,
        temperature: Math.min(0.2, constraints.temperature.max),
        topP: 0.8,
      };

    case "conversation":
    default:
      return baseSettings;
  }
}

// =============================================================================
// Discovery Chat Defaults
// =============================================================================

/**
 * Default system prompt for discovery chat
 */
export const DISCOVERY_CHAT_SYSTEM_PROMPT = `You are a helpful assistant guiding the user through exploring and refining their ideas before running a multi-model collaboration flow.

Help the user:
- Clarify what they want to accomplish
- Refine their task description
- Think through the problem from multiple angles
- Identify what perspectives would be valuable

Be conversational and helpful. Ask clarifying questions when needed. When the user seems ready, encourage them to proceed to configuration.`;

/**
 * System prompt for synthesizing a discovery transcript into a task description.
 * Used by the /api/chat/synthesize endpoint.
 */
export const SYNTHESIS_SYSTEM_PROMPT = `You are a task extraction assistant. Given a discovery conversation transcript between a user and an AI assistant, extract a clear, actionable task description.

Your output should be:
- A concise but comprehensive task description (1-3 paragraphs)
- Written as a direct instruction/request (not a conversation summary)
- Include specific details, constraints, and goals mentioned by the user
- Preserve the user's intent and any refined understanding from the conversation
- Ready to be used as the prompt for a multi-model AI collaboration flow

Output ONLY the task description. No preamble, no explanation, no markdown headers.`;

/**
 * Get default settings for discovery chat
 */
export function getDiscoveryChatSettings(modelId: string): LLMSettings {
  return {
    ...getDefaultSettings(modelId),
    temperature: 0.8, // Slightly creative for brainstorming
    maxTokens: 2048, // Shorter responses for chat
  };
}

// =============================================================================
// Iteration Context
// =============================================================================

/**
 * Format previous responses for injection into next iteration
 */
export function formatPreviousResponses(
  responses: Array<{ agentId: string; agentName: string; content: string }>
): string {
  return responses
    .map(
      (r) => `--- ${r.agentName} ---
${r.content}`
    )
    .join("\n\n");
}

/**
 * Build iteration context prompt addition
 */
export function buildIterationContext(
  turnNumber: number,
  previousResponses: Array<{ agentId: string; agentName: string; content: string }>,
  userEdits?: Array<{ agentId: string; agentName: string; originalContent: string; editedContent: string }>
): string {
  let context = `\n\n--- Previous Turn (Turn ${turnNumber - 1}) ---\n`;
  context += formatPreviousResponses(previousResponses);

  if (userEdits && userEdits.length > 0) {
    context += "\n\n--- User Edits Applied ---\n";
    for (const edit of userEdits) {
      context += `${edit.agentName}: User modified this response.\n`;
    }
  }

  return context;
}
