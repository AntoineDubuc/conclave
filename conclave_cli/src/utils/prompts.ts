import fs from 'fs';
import chalk from 'chalk/index.js';

/**
 * Resolves a prompt that could be either a string or a file path.
 * If it looks like a file path (.md or .txt) and exists, reads the file.
 * Otherwise returns the string as-is.
 */
export function resolvePrompt(promptOrPath: string): string {
    // If it has newlines, it's definitely a prompt string, not a path
    if (promptOrPath.includes('\n')) {
        return promptOrPath;
    }

    // Check if it looks like a file path and exists
    if ((promptOrPath.endsWith('.md') || promptOrPath.endsWith('.txt')) && fs.existsSync(promptOrPath)) {
        try {
            console.log(chalk.gray(`Loading prompt from file: ${promptOrPath}`));
            return fs.readFileSync(promptOrPath, 'utf-8');
        } catch (e) {
            console.warn(chalk.yellow(`Failed to read prompt file ${promptOrPath}, using as string.`));
        }
    }

    return promptOrPath;
}
