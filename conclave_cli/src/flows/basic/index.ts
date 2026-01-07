export { BasicFlowEngine as Engine } from './engine.js';
export { defaultPrompts } from './prompts.js';

export const metadata = {
    type: 'basic',
    displayName: 'Basic Ideator',
    description: 'Round-robin democratic debate. All models brainstorm independently, then everyone sees everyone\'s work and refines together.',
    pattern: 'Round-Robin (Democratic)',
    requiredConfig: [] as string[],
};
