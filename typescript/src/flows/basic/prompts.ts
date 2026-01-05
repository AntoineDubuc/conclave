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
};

/**
 * System prompt used during refinement rounds.
 * This is parameterized, so it stays in code.
 */
export function getRefinementSystemPrompt(round: number, maxRounds: number): string {
    return `You are participating in a refinement loop (Round ${round} of ${maxRounds}). Critically analyze peer feedback and improve your work.`;
}
