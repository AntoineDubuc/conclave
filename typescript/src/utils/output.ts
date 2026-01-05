import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface RunContext {
    runId: string;
    runDir: string;
}

/**
 * Creates a new run context with unique ID and output directory.
 */
export function createRunContext(): RunContext {
    const runId = randomUUID().split('-')[0];
    const runDir = path.join(process.cwd(), '.conclave', 'runs', runId);
    return { runId, runDir };
}

/**
 * Saves output content to a file in the run directory.
 * Creates the directory if it doesn't exist.
 */
export function saveOutput(
    runDir: string,
    provider: string,
    round: number,
    content: string,
    suffix?: string
): void {
    if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
    }

    const suffixPart = suffix ? `.${suffix}` : '';
    const filename = `${provider.toLowerCase()}${suffixPart}.v${round}.md`;
    fs.writeFileSync(path.join(runDir, filename), content);
}

/**
 * Reads input file content.
 */
export function readInputFile(inputFile: string): string {
    return fs.readFileSync(inputFile, 'utf-8');
}
