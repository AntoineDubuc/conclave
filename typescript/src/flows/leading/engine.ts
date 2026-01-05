import chalk from 'chalk';
import ora from 'ora';
import { Provider } from '../../providers/base.js';
import { resolvePrompt, createRunContext, saveOutput, readInputFile } from '../../utils/index.js';
import { getLeaderSystemPrompt, getContributorSystemPrompt } from './prompts.js';

// Flow config type (matches what's in janus.config.yaml)
interface FlowConfig {
    name: string;
    description?: string;
    flow_type?: string;
    max_rounds: number;
    default_leader?: string;
    active_providers?: string[];
    prompts: {
        round_1: string;
        refinement: string;
        leader_synthesis?: string;
    };
}

interface RunState {
    round: number;
    outputs: Record<string, string>;
}

/**
 * LeadingFlowEngine implements the hub-and-spoke pattern:
 *
 * Step 1: Everyone ideates independently (parallel)
 * Step 2: LEADER synthesizes all outputs into unified vision
 * Step 3: NON-LEADERS respond to leader's synthesis
 * Step 4: LEADER synthesizes again from responses
 * ... alternating until max_rounds
 */
export class LeadingFlowEngine {
    private runId: string;
    private runDir: string;

    constructor(
        private providers: Provider[],
        private flow: FlowConfig,
        private leaderName: string
    ) {
        const ctx = createRunContext();
        this.runId = ctx.runId;
        this.runDir = ctx.runDir;
    }

    private getLeaderProvider(): Provider | undefined {
        return this.providers.find(p =>
            p.name.toLowerCase().includes(this.leaderName.toLowerCase()) ||
            this.leaderName.toLowerCase().includes(p.name.toLowerCase())
        );
    }

    private getNonLeaderProviders(): Provider[] {
        const leader = this.getLeaderProvider();
        return this.providers.filter(p => p !== leader);
    }

    public async run(inputFile: string, initialPromptOverride?: string): Promise<void> {
        const leader = this.getLeaderProvider();
        if (!leader) {
            console.error(chalk.red(`Error: Leader provider '${this.leaderName}' not found.`));
            console.log(`Available providers: ${this.providers.map(p => p.name).join(', ')}`);
            return;
        }

        const nonLeaders = this.getNonLeaderProviders();

        console.log(chalk.green(`\nStarting Flow: ${this.flow.name} (Run ID: ${this.runId})`));
        console.log(chalk.cyan(`Leader: ${leader.name}`));
        console.log(chalk.gray(`Contributors: ${nonLeaders.map(p => p.name).join(', ')}`));
        console.log(chalk.gray(`Output Directory: ${this.runDir}\n`));

        const inputContent = readInputFile(inputFile);
        const history: RunState[] = [];
        let currentRound = 1;

        // --- STEP 1: Everyone ideates independently ---
        const step1Spinner = ora('Step 1: Everyone ideates independently').start();
        const round1Outputs: Record<string, string> = {};

        const round1PromptText = initialPromptOverride || resolvePrompt(this.flow.prompts.round_1);
        const fullRound1Prompt = `${round1PromptText}\n\n[INPUT FILE START]\n${inputContent}\n[INPUT FILE END]`;

        const allProviders = [leader, ...nonLeaders];
        const round1Promises = allProviders.map(async (provider) => {
            const result = await provider.generate(fullRound1Prompt);
            saveOutput(this.runDir, provider.name, 1, result);
            round1Outputs[provider.name] = result;
        });

        await Promise.all(round1Promises);
        history.push({ round: 1, outputs: round1Outputs });
        step1Spinner.succeed('Step 1 Complete: Everyone has ideated');
        currentRound++;

        // --- ALTERNATING LOOP ---
        while (currentRound <= this.flow.max_rounds) {
            const prevOutputs = history[history.length - 1].outputs;

            // LEADER SYNTHESIS STEP
            const leaderSpinner = ora(`Step ${currentRound}: Leader synthesizes`).start();

            // Gather all outputs for leader to review
            const allContributions = allProviders
                .map(p => `[CONTRIBUTION FROM ${p.name.toUpperCase()}]\n${prevOutputs[p.name] || 'No output'}`)
                .join('\n\n---\n\n');

            const leaderPrompt = this.flow.prompts.leader_synthesis || this.flow.prompts.refinement;
            const fullLeaderPrompt = `${resolvePrompt(leaderPrompt)}

[ALL CONTRIBUTIONS]
${allContributions}

[TASK]
Synthesize a unified v${currentRound} plan that incorporates the best ideas from all contributors.`;

            const leaderResult = await leader.generate(fullLeaderPrompt, {
                systemPrompt: getLeaderSystemPrompt(currentRound, this.flow.max_rounds)
            });

            saveOutput(this.runDir, leader.name, currentRound, leaderResult, 'synthesis');
            const leaderOutputs: Record<string, string> = { [leader.name]: leaderResult };

            leaderSpinner.succeed(`Step ${currentRound} Complete: Leader synthesized`);
            currentRound++;

            if (currentRound > this.flow.max_rounds) {
                history.push({ round: currentRound - 1, outputs: leaderOutputs });
                break;
            }

            // NON-LEADERS RESPOND STEP
            const respondSpinner = ora(`Step ${currentRound}: Contributors respond to leader`).start();

            const refinementPrompt = resolvePrompt(this.flow.prompts.refinement);
            const respondOutputs: Record<string, string> = {};

            const respondPromises = nonLeaders.map(async (provider) => {
                const myPrevOutput = prevOutputs[provider.name] || '';

                const fullRespondPrompt = `${refinementPrompt}

[YOUR PREVIOUS VERSION (v${currentRound - 2})]
${myPrevOutput}

[LEADER'S SYNTHESIS (v${currentRound - 1})]
${leaderResult}

[TASK]
Based on the leader's synthesis, provide your v${currentRound} response. Identify improvements, gaps, or alternative approaches.`;

                const result = await provider.generate(fullRespondPrompt, {
                    systemPrompt: getContributorSystemPrompt(currentRound, this.flow.max_rounds)
                });

                saveOutput(this.runDir, provider.name, currentRound, result);
                return { provider: provider.name, output: result };
            });

            const responses = await Promise.all(respondPromises);
            responses.forEach(({ provider, output }) => {
                respondOutputs[provider] = output;
            });

            // Merge leader's synthesis with responses for next round
            const mergedOutputs = { ...respondOutputs, [leader.name]: leaderResult };
            history.push({ round: currentRound, outputs: mergedOutputs });

            respondSpinner.succeed(`Step ${currentRound} Complete: Contributors responded`);
            currentRound++;
        }

        console.log(chalk.bold.green(`\nFlow Complete!`));
        console.log(`Explore the results in: ${this.runDir}`);
        console.log(chalk.cyan(`\nFinal synthesis from ${leader.name} is the recommended output.`));
    }
}
