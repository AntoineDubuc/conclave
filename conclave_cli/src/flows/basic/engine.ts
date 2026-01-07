import chalk from 'chalk/index.js';
import ora from 'ora';
import { Provider } from '../../providers/base.js';
import { resolvePrompt, createRunContext, saveOutput, readInputFile } from '../../utils/index.js';
import { getRefinementSystemPrompt } from './prompts.js';

// Flow config type (matches what's in conclave.config.yaml)
interface FlowConfig {
    name: string;
    description?: string;
    flow_type?: string;
    max_rounds: number;
    active_providers?: string[];
    prompts: {
        round_1: string;
        refinement: string;
    };
}

interface RunState {
    round: number;
    outputs: Record<string, string>;
}

/**
 * BasicFlowEngine implements the round-robin democratic pattern:
 *
 * Round 1 (Divergence): Everyone brainstorms independently
 * Round 2+ (Convergence): Everyone sees ALL peer outputs and refines
 *
 * This is a democratic flow - all providers are equal participants.
 */
export class BasicFlowEngine {
    private runId: string;
    private runDir: string;

    constructor(
        private providers: Provider[],
        private flow: FlowConfig
    ) {
        const ctx = createRunContext();
        this.runId = ctx.runId;
        this.runDir = ctx.runDir;
    }

    public async run(inputFile: string, initialPromptOverride?: string): Promise<void> {
        console.log(chalk.green(`\nStarting Flow: ${this.flow.name} (Run ID: ${this.runId})`));
        console.log(chalk.gray(`Output Directory: ${this.runDir}\n`));

        const history: RunState[] = [];
        const inputContent = readInputFile(inputFile);

        // Filter providers if flow defines specific ones
        const activeProviders = this.flow.active_providers
            ? this.providers.filter(p =>
                this.flow.active_providers?.includes(p.name.toLowerCase()) ||
                this.flow.active_providers?.includes(p.name)
            )
            : this.providers;

        if (activeProviders.length === 0) {
            console.error(chalk.red('No active providers found for this flow configuration.'));
            return;
        }

        // --- Round 1: Divergence ---
        const round1Spinner = ora('Round 1: Divergence (Brainstorming)').start();
        const round1Outputs: Record<string, string> = {};

        const round1PromptText = initialPromptOverride || resolvePrompt(this.flow.prompts.round_1);
        const fullRound1Prompt = `${round1PromptText}\n\n[INPUT FILE START]\n${inputContent}\n[INPUT FILE END]`;

        const round1Promises = activeProviders.map(async (provider) => {
            const result = await provider.generate(fullRound1Prompt);
            saveOutput(this.runDir, provider.name, 1, result);
            round1Outputs[provider.name] = result;
        });

        await Promise.all(round1Promises);
        history.push({ round: 1, outputs: round1Outputs });
        round1Spinner.succeed('Round 1 Complete');

        // --- Convergence Rounds (2..N) ---
        for (let round = 2; round <= this.flow.max_rounds; round++) {
            const spinner = ora(`Round ${round}: Convergence (Refinement)`).start();

            const prevOutputs = history[history.length - 1].outputs;
            const roundOutputs: Record<string, string> = {};

            const roundPromises = activeProviders.map(async (provider) => {
                const previousOutput = prevOutputs[provider.name] || '';

                // Get other providers' outputs
                const otherOutputs = activeProviders
                    .filter(p => p.name !== provider.name)
                    .map(p => `[PEER REVIEW FROM ${p.name.toUpperCase()}]\n${prevOutputs[p.name] || 'No output'}`)
                    .join('\n\n');

                const refinementPrompt = resolvePrompt(this.flow.prompts.refinement);
                const fullPrompt = `${refinementPrompt}

[YOUR PREVIOUS VERSION (v${round - 1})]
${previousOutput}

[PEER REVIEWS]
${otherOutputs}

[TASK]
Based on the critiques and ideas from your peers, output the v${round} version of the plan.`;

                const result = await provider.generate(fullPrompt, {
                    systemPrompt: getRefinementSystemPrompt(round, this.flow.max_rounds)
                });

                saveOutput(this.runDir, provider.name, round, result);
                return { provider: provider.name, output: result };
            });

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
