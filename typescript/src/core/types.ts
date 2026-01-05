import { z } from 'zod';

export const FlowSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    flow_type: z.enum(['basic', 'leading']).default('basic'), // basic = round-robin, leading = hub-and-spoke
    max_rounds: z.number().default(2),
    default_leader: z.string().optional(), // For leading flows: which provider leads (e.g., 'anthropic')
    prompts: z.object({
        round_1: z.string(),
        refinement: z.string(), // The prompt used for Round 2..N (non-leaders in leading flow)
        leader_synthesis: z.string().optional(), // For leading flows: how leader synthesizes
    }),
});

export const ProviderConfigSchema = z.object({
    type: z.enum(['anthropic', 'openai', 'gemini', 'openai_compatible', 'grok']),
    model: z.string().optional(),
    auth_method: z.enum(['cli', 'api_key', 'auto']).optional().default('auto'), // How to authenticate
    api_key: z.string().optional(), // Can also be env var
    endpoint: z.string().optional(), // For openai_compatible
    base_url: z.string().optional(), // For openai_compatible
});

export const ConclaveConfigSchema = z.object({
    active_providers: z.array(z.string()), // Global default providers
    providers: z.record(z.string(), ProviderConfigSchema),
    flows: z.record(z.string(), z.object({
        name: z.string(),
        description: z.string().optional(),
        flow_type: z.enum(['basic', 'leading']).optional().default('basic'),
        max_rounds: z.number(),
        default_leader: z.string().optional(),
        active_providers: z.array(z.string()).optional(),
        prompts: z.object({
            round_1: z.string(),
            refinement: z.string(),
            leader_synthesis: z.string().optional()
        })
    })),
    // Lenses can be added later
});

export type ConclaveConfig = z.infer<typeof ConclaveConfigSchema>;
export type FlowConfig = z.infer<typeof FlowSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const DEFAULT_CONFIG: ConclaveConfig = {
    active_providers: ['anthropic', 'openai', 'gemini'],
    providers: {
        anthropic: { type: 'anthropic', model: 'claude-opus-4-5-20251101', auth_method: 'auto' },
        openai: { type: 'openai', model: 'gpt-5.2', auth_method: 'api_key' },
        gemini: { type: 'gemini', model: 'gemini-3-pro-preview', auth_method: 'api_key' },
        grok: { type: 'openai_compatible', model: 'grok-3', auth_method: 'api_key', api_key: '', base_url: 'https://api.x.ai/v1' }
    },
    flows: {
        'basic-ideator': {
            name: 'Basic Ideator',
            description: 'All models brainstorm independently, then everyone sees everyone\'s work and refines. Democratic round-robin.',
            flow_type: 'basic',
            max_rounds: 3,
            prompts: {
                round_1: "You are an expert architect. Analyze the user's request and provide a comprehensive, actionable plan. Be creative but grounded.",
                refinement: "You are reviewing the work of your peers. Attached are their proposals, along with your original one. Critique their approaches, identify what they did better than you, and synthesize a new, superior version (vNext) of your plan that incorporates their best ideas while maintaining your unique strengths.",
            },
        },
        'leading-ideator': {
            name: 'Leading Ideator',
            description: 'One model leads and synthesizes. Others contribute ideas, leader distills the best into a unified vision.',
            flow_type: 'leading',
            default_leader: 'anthropic',
            max_rounds: 4,
            prompts: {
                round_1: "You are an expert architect. Analyze the user's request and provide a comprehensive, actionable plan. Be creative but grounded.",
                refinement: "The lead architect has synthesized a unified plan from all contributions. Review their synthesis below. Identify gaps, improvements, or alternative approaches they may have missed. Provide your refined perspective.",
                leader_synthesis: "You are the lead architect synthesizing input from your team. Review all contributions below. Extract the best ideas from each, resolve conflicts, and create a unified, superior plan that represents the best thinking of the group. Be decisive but acknowledge strong alternative viewpoints.",
            },
        },
        'audit': {
            name: 'Code Audit',
            description: 'Multiple security experts analyze code, then cross-review findings.',
            flow_type: 'basic',
            max_rounds: 2,
            prompts: {
                round_1: "You are a senior security engineer. Analyze the attached code for vulnerabilities, logical errors, and code smell. Be ruthless.",
                refinement: "Review the findings of the other auditors. Did you miss anything they found? Verify their claims. Output a finalized, unified list of critical issues.",
            },
        },
    },
};
