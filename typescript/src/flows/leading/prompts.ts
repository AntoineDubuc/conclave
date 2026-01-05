import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load a prompt from a markdown file in this flow's folder.
 */
export function loadPrompt(name: string): string {
    const promptPath = path.join(__dirname, `${name}.md`);
    if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf-8').trim();
    }
    throw new Error(`Prompt file not found: ${promptPath}`);
}

/**
 * Default prompts - loaded from markdown files.
 * These are used when the flow config doesn't override them.
 */
export const defaultPrompts = {
    get round_1() { return loadPrompt('round-1'); },
    get refinement() { return loadPrompt('refinement'); },
    get leader_synthesis() { return loadPrompt('leader-synthesis'); },
};

/**
 * System prompt for the leader during synthesis rounds.
 * Parameterized, so stays in code.
 */
export function getLeaderSystemPrompt(round: number, maxRounds: number): string {
    return `You are the lead architect (Round ${round} of ${maxRounds}). Your role is to synthesize the best ideas from your team into a cohesive plan.`;
}

/**
 * System prompt for contributors responding to leader's synthesis.
 * Parameterized, so stays in code.
 */
export function getContributorSystemPrompt(round: number, maxRounds: number): string {
    return `You are a contributing architect (Round ${round} of ${maxRounds}). Review the leader's synthesis and provide your refined perspective.`;
}
