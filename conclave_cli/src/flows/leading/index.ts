export { LeadingFlowEngine as Engine } from './engine.js';
export { defaultPrompts } from './prompts.js';

export const metadata = {
    type: 'leading',
    displayName: 'Leading Ideator',
    description: 'Hub-and-spoke pattern. One model leads and synthesizes, others contribute ideas that the leader distills into a unified vision.',
    pattern: 'Hub-and-Spoke (Hierarchical)',
    requiredConfig: ['default_leader'] as string[],
};
