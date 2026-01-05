import { z } from 'zod';

export const FlowSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    max_rounds: z.number().default(2),
    prompts: z.object({
        round_1: z.string(),
        refinement: z.string(), // The prompt used for Round 2..N
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

export const JanusConfigSchema = z.object({
    active_providers: z.array(z.string()), // Global default providers
    providers: z.record(z.string(), ProviderConfigSchema),
    flows: z.record(z.string(), z.object({
        name: z.string(),
        description: z.string().optional(),
        max_rounds: z.number(),
        active_providers: z.array(z.string()).optional(),
        prompts: z.object({
            round_1: z.string(),
            refinement: z.string()
        })
    })),
    // Lenses can be added later
});

export type JanusConfig = z.infer<typeof JanusConfigSchema>;
export type FlowConfig = z.infer<typeof FlowSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const DEFAULT_CONFIG: JanusConfig = {
    active_providers: ['anthropic', 'openai', 'gemini'],
    providers: {
        anthropic: { type: 'anthropic', model: 'claude-opus-4-5-20251101', auth_method: 'auto' },
        openai: { type: 'openai', model: 'gpt-5.2', auth_method: 'api_key' },
        gemini: { type: 'gemini', model: 'gemini-3-pro-preview', auth_method: 'api_key' },
        grok: { type: 'openai_compatible', model: 'grok-3', auth_method: 'api_key', api_key: '', base_url: 'https://api.x.ai/v1' }
    },
    flows: {
        ideation: {
            name: 'Ideation',
            description: 'Divergent thinking followed by convergence.',
            max_rounds: 3,
            prompts: {
                round_1: "You are an expert architect. Analyze the user's request and provide a comprehensive, actionable plan. Be creative but grounded.",
                refinement: "You are reviewing the work of your peers. Attached are their proposals, along with your original one. Critique their approaches, identify what they performed better than you, and synthesize a new, superior version (vNext) of your plan that incorporates their best ideas while maintaining your unique strengths.",
            },
        },
        audit: {
            name: 'Code Audit',
            description: 'Find bugs and security flaws.',
            max_rounds: 2,
            prompts: {
                round_1: "You are a senior security engineer. Analyze the attached code for vulnerabilities, logical errors, and smell. Be ruthless.",
                refinement: "Review the findings of the other auditors. Did you miss anything they found? Verify their claims. Output a finalized, unified list of critical issues.",
            },
        },
    },
};
