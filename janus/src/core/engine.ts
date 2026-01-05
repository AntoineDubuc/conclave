import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { randomUUID } from 'crypto';
import { Provider } from '../providers/base.js';
import { JanusConfig } from './types.js';

// Extract Flow type from JanusConfig
type FlowConfig = JanusConfig['flows'][string];

interface RunState {
    round: number;
    outputs: Record<string, string>; // providerName -> markdown content
}

export class FlowEngine {
    private runId: string;
    private runDir: string;

    constructor(private providers: Provider[], private flow: FlowConfig) {
        this.runId = randomUUID().split('-')[0]; // Short ID
        // We assume we run from CWD
        this.runDir = path.join(process.cwd(), '.janus', 'runs', this.runId);
    }

    private resolvePrompt(promptOrPath: string): string {
        // Check if it looks like a file path and exists
        // Simple heuristic: if it has newlines, it's likely a prompt text, not a path.
        if (!promptOrPath.includes('\n') && (promptOrPath.endsWith('.md') || promptOrPath.endsWith('.txt')) && fs.existsSync(promptOrPath)) {
            try {
                console.log(chalk.gray(`Loading prompt from file: ${promptOrPath}`));
                return fs.readFileSync(promptOrPath, 'utf-8');
            } catch (e) {
                console.warn(chalk.yellow(`Failed to read prompt file ${promptOrPath}, using as string.`));
            }
        }
        return promptOrPath;
    }

    private saveOutput(provider: string, round: number, content: string) {
        if (!fs.existsSync(this.runDir)) {
            fs.mkdirSync(this.runDir, { recursive: true });
        }
        const filename = `${provider.toLowerCase()}.v${round}.md`;
        fs.writeFileSync(path.join(this.runDir, filename), content);
    }

    public async run(inputFile: string, initialPromptOverride?: string) {
        console.log(chalk.green(`\nStarting Flow: ${this.flow.name} (Run ID: ${this.runId})`));
        console.log(chalk.gray(`Output Directory: ${this.runDir}\n`));

        let history: RunState[] = [];
        const inputContent = fs.readFileSync(inputFile, 'utf-8');

        // --- Round 1: Divergence ---
        const round1Spinner = ora('Round 1: Divergence (Brainstorming)').start();
        const round1Outputs: Record<string, string> = {};

        // Filter providers if flow defines specific ones
        const activeProviders = this.flow.active_providers
            ? this.providers.filter(p => this.flow.active_providers?.includes(p.name.toLowerCase()) || this.flow.active_providers?.includes(p.name))
            : this.providers;

        if (activeProviders.length === 0) {
            round1Spinner.fail('No active providers found for this flow configuration.');
            return;
        }

        const round1PromptText = initialPromptOverride || this.resolvePrompt(this.flow.prompts.round_1);
        const fullRound1Prompt = `${round1PromptText}\n\n[INPUT FILE START]\n${inputContent}\n[INPUT FILE END]`;

        const round1Promises = activeProviders.map(async (provider) => {
            const result = await provider.generate(fullRound1Prompt);
            this.saveOutput(provider.name, 1, result);
            round1Outputs[provider.name] = result;
        });

        await Promise.all(round1Promises);
        history.push({ round: 1, outputs: round1Outputs });
        round1Spinner.succeed('Round 1 Complete');

        // --- CONVERGENCE LOOPS (Rounds 2..N) ---
        for (let round = 2; round <= this.flow.max_rounds; round++) {
            const spinner = ora(`Round ${round}: Convergence (Refinement)`).start();

            const prevRoundKey = `Round ${round - 1}`;
            // In a real state machine, we'd load previous outputs more robustly.
            // For now, we use the in-memory map from this run.
            const prevOutputs = history[history.length - 1].outputs;
            const roundOutputs: Record<string, string> = {};

            const roundPromises: Promise<{ provider: string, output: string }>[] = [];

            for (const provider of activeProviders) {
                const previousOutput = prevOutputs[provider.name] || "";

                // Get other providers' outputs
                const otherOutputs = activeProviders
                    .filter(p => p.name !== provider.name)
                    .map(p => `[PEER REVIEW FROM ${p.name.toUpperCase()}]\n${prevOutputs[p.name] || "No output"}`)
                    .join('\n\n');

                // Construct Prompt
                const refinementPrompt = this.resolvePrompt(this.flow.prompts.refinement);
                const fullPrompt = `${refinementPrompt}

[YOUR PREVIOUS VERSION (v${round - 1})]
${previousOutput}

[PEER REVIEWS]
${otherOutputs}

[TASK]
Based on the critiques and ideas from your peers, output the v${round} version of the plan.`;

                const promise = provider.generate(fullPrompt, {
                    systemPrompt: `You are participating in a refinement loop (Round ${round} of ${this.flow.max_rounds}). Critically analyze peer feedback and improve your work.`
                }).then(output => {
                    this.saveOutput(provider.name, round, output);
                    return { provider: provider.name, output };
                });
                roundPromises.push(promise);
            } // end for loop

            const outputs = await Promise.all(roundPromises);
            outputs.forEach(({ provider, output }) => {
                roundOutputs[provider] = output;
            });
            history.push({ round, outputs: roundOutputs });
            spinner.succeed(`Round ${round} Complete`);
        }

        console.log(chalk.bold.green(`\nFlow Complete!`));
        console.log(`Explore the results in: ${this.runDir}`);
    }
}
