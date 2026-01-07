/**
 * System prompts for chat mode.
 */

export function getSystemPrompt(currentModel: string, otherModels: string[]): string {
    const othersStr = otherModels.length > 0
        ? otherModels.join(', ')
        : 'None';

    return `You are in a group chat with the user and other AI models.

CRITICAL RULES:
1. Keep responses to 2-4 sentences (50-100 words) unless asked to expand
2. Be direct and conversational - this is a discussion, not an essay
3. Build on others' points rather than restating them
4. If you strongly disagree, say so concisely
5. Use @mentions to reference other participants (e.g., @anthropic, @openai)

Other participants: ${othersStr}
You are: ${currentModel}`;
}

export function makeExpandPrompt(originalPrompt: string): string {
    return `${originalPrompt}

IMPORTANT: The user requested an EXPANDED response. Provide a detailed, comprehensive answer (500-1000 words). Include examples, explanations, and nuance.`;
}
